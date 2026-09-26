package com.example.data.repository

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import android.provider.OpenableColumns
import com.example.data.local.*
import com.example.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class LocalTubeRepository(
    private val context: Context,
    private val dao: LocalTubeDao
) {

    // --- Flows ---
    val allVideos: Flow<List<VideoItem>> = dao.getAllVideos().map { list ->
        list.map { it.toDomain() }
    }

    val allChannels: Flow<List<ChannelItem>> = dao.getAllChannels().map { list ->
        list.map { it.toDomain() }
    }

    val allPlaylists: Flow<List<PlaylistItem>> = dao.getAllPlaylists().map { list ->
        list.map { it.toDomain() }
    }

    val allWatchProgress: Flow<Map<String, WatchProgressItem>> = dao.getAllWatchProgress().map { list ->
        list.associate { it.videoKey to it.toDomain() }
    }

    val watchHistory: Flow<List<WatchHistoryItem>> = dao.getWatchHistory().map { list ->
        list.map { WatchHistoryItem(it.id, it.videoKey, it.watchedAt) }
    }

    val userInteractions: Flow<Map<String, UserInteractionEntity>> = dao.getAllInteractions().map { list ->
        list.associateBy { it.videoKey }
    }

    val searchHistory: Flow<List<String>> = dao.getSearchHistory().map { list ->
        list.map { it.query }
    }

    val appPreferences: Flow<Map<String, String>> = dao.getAllPreferences().map { list ->
        list.associate { it.key to it.value }
    }

    suspend fun initializeDefaultsIfNeeded() {
        withContext(Dispatchers.IO) {
            val existingChannels = dao.getAllChannels().first()
            if (existingChannels.isEmpty()) {
                dao.insertChannels(InitialDataSeeder.defaultChannels)
            }
            val existingPlaylists = dao.getAllPlaylists().first()
            if (existingPlaylists.isEmpty()) {
                dao.insertPlaylists(InitialDataSeeder.defaultPlaylists)
            }
            val existingVideos = dao.getAllVideos().first()
            if (existingVideos.isEmpty()) {
                dao.insertVideos(InitialDataSeeder.sampleVideos)
            }
        }
    }

    // --- Device Media Scanning ---
    suspend fun scanDeviceMediaVideos(): Int = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val projection = arrayOf(
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.DISPLAY_NAME,
            MediaStore.Video.Media.TITLE,
            MediaStore.Video.Media.SIZE,
            MediaStore.Video.Media.DURATION
        )

        var count = 0
        try {
            val cursor: Cursor? = resolver.query(
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                "${MediaStore.Video.Media.DATE_ADDED} DESC"
            )

            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
                val nameCol = it.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
                val titleCol = it.getColumnIndex(MediaStore.Video.Media.TITLE)
                val sizeCol = it.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)
                val durCol = it.getColumnIndex(MediaStore.Video.Media.DURATION)

                val entities = mutableListOf<VideoEntity>()

                while (it.moveToNext()) {
                    val id = it.getLong(idCol)
                    val name = it.getString(nameCol) ?: "video_${id}.mp4"
                    val rawTitle = if (titleCol != -1) it.getString(titleCol) else null
                    val title = cleanTitle(rawTitle ?: name)
                    val size = it.getLong(sizeCol)
                    val durationMs = if (durCol != -1) it.getLong(durCol) else 0L
                    val uri = Uri.withAppendedPath(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id.toString())
                    val ext = name.substringAfterLast('.', "MP4").uppercase(Locale.ROOT)
                    val isShort = (durationMs in 1..60000L) || name.contains("short", ignoreCase = true)
                    val key = "media_${id}_${size}"

                    entities.add(
                        VideoEntity(
                            key = key,
                            name = name,
                            title = title,
                            uriString = uri.toString(),
                            size = size,
                            formattedSize = formatBytes(size),
                            durationMs = durationMs,
                            formattedDuration = formatDuration(durationMs),
                            ext = ext,
                            isShort = isShort,
                            channelId = null,
                            collabChannelIds = "",
                            tags = if (isShort) "shorts" else "",
                            thumbnailUri = null,
                            isCustomThumbnail = false,
                            dateAdded = System.currentTimeMillis()
                        )
                    )
                }

                if (entities.isNotEmpty()) {
                    dao.insertVideos(entities)
                    count = entities.size
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        count
    }

    // --- Import Videos from SAF Document URIs ---
    suspend fun importVideosFromUris(uris: List<Uri>): Int = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val newEntities = mutableListOf<VideoEntity>()

        for (uri in uris) {
            try {
                var fileName = "video_${System.currentTimeMillis()}.mp4"
                var fileSize = 0L

                resolver.query(uri, null, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                        if (nameIndex != -1) {
                            fileName = cursor.getString(nameIndex) ?: fileName
                        }
                        if (sizeIndex != -1) {
                            fileSize = cursor.getLong(sizeIndex)
                        }
                    }
                }

                var durationMs = 0L
                try {
                    val retriever = MediaMetadataRetriever()
                    retriever.setDataSource(context, uri)
                    val durStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    durationMs = durStr?.toLongOrNull() ?: 0L
                    retriever.release()
                } catch (e: Exception) {
                    // Ignore metadata error
                }

                val title = cleanTitle(fileName)
                val ext = fileName.substringAfterLast('.', "MP4").uppercase(Locale.ROOT)
                val isShort = (durationMs in 1..60000L) || fileName.contains("short", ignoreCase = true)
                val key = "local_${fileName}_${fileSize}"

                newEntities.add(
                    VideoEntity(
                        key = key,
                        name = fileName,
                        title = title,
                        uriString = uri.toString(),
                        size = fileSize,
                        formattedSize = formatBytes(fileSize),
                        durationMs = durationMs,
                        formattedDuration = formatDuration(durationMs),
                        ext = ext,
                        isShort = isShort,
                        channelId = null,
                        collabChannelIds = "",
                        tags = if (isShort) "shorts" else "",
                        thumbnailUri = null,
                        isCustomThumbnail = false,
                        dateAdded = System.currentTimeMillis()
                    )
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        if (newEntities.isNotEmpty()) {
            dao.insertVideos(newEntities)
        }
        newEntities.size
    }

    // --- Channel Operations ---
    suspend fun createChannel(
        name: String,
        handle: String?,
        colorHex: String,
        description: String,
        logoUri: String? = null
    ): ChannelItem = withContext(Dispatchers.IO) {
        val cleanName = name.trim()
        var cleanHandle = (handle ?: "").trim()
        if (cleanHandle.isEmpty()) {
            cleanHandle = "@" + cleanName.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
        }
        if (!cleanHandle.startsWith("@")) {
            cleanHandle = "@$cleanHandle"
        }
        val id = "channel_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val entity = ChannelEntity(
            id = id,
            name = cleanName,
            handle = cleanHandle,
            colorHex = colorHex,
            description = description.ifBlank { "Welcome to $cleanName. Offline local video channel." },
            logoUri = logoUri,
            createdAt = System.currentTimeMillis(),
            isSubscribed = true
        )
        dao.insertChannel(entity)
        entity.toDomain()
    }

    suspend fun updateChannel(
        id: String,
        name: String,
        handle: String,
        colorHex: String,
        description: String,
        logoUri: String?
    ) = withContext(Dispatchers.IO) {
        val existing = dao.getAllChannels().first().find { it.id == id }
        val isSub = existing?.isSubscribed ?: true
        val updated = ChannelEntity(
            id = id,
            name = name.trim(),
            handle = if (handle.startsWith("@")) handle else "@$handle",
            colorHex = colorHex,
            description = description,
            logoUri = logoUri ?: existing?.logoUri,
            createdAt = existing?.createdAt ?: System.currentTimeMillis(),
            isSubscribed = isSub
        )
        dao.insertChannel(updated)
    }

    suspend fun toggleSubscription(channelId: String) = withContext(Dispatchers.IO) {
        val channels = dao.getAllChannels().first()
        val ch = channels.find { it.id == channelId } ?: return@withContext
        dao.updateChannelSubscription(channelId, !ch.isSubscribed)
    }

    suspend fun deleteChannel(channelId: String) = withContext(Dispatchers.IO) {
        dao.deleteChannel(channelId)
        // Unassign videos from this channel
        val videos = dao.getAllVideos().first()
        val updatedVideos = mutableListOf<VideoEntity>()
        for (v in videos) {
            var changed = false
            var newChannelId = v.channelId
            if (v.channelId == channelId) {
                newChannelId = null
                changed = true
            }
            var newCollabs = v.collabChannelIds
            if (v.collabChannelIds.contains(channelId)) {
                val list = v.collabChannelIds.split(",").filter { it.isNotBlank() && it != channelId }
                newCollabs = list.joinToString(",")
                changed = true
            }
            if (changed) {
                updatedVideos.add(v.copy(channelId = newChannelId, collabChannelIds = newCollabs))
            }
        }
        if (updatedVideos.isNotEmpty()) {
            dao.insertVideos(updatedVideos)
        }
    }

    suspend fun assignVideoToChannel(
        videoKey: String,
        primaryChannelId: String?,
        collabIds: List<String>
    ) = withContext(Dispatchers.IO) {
        val v = dao.getVideoByKey(videoKey) ?: return@withContext
        val cleanCollabs = collabIds.filter { it.isNotBlank() && it != primaryChannelId }.joinToString(",")
        val updated = v.copy(
            channelId = primaryChannelId,
            collabChannelIds = cleanCollabs
        )
        dao.insertVideo(updated)
    }

    suspend fun batchAssignVideosToChannel(
        videoKeys: List<String>,
        primaryChannelId: String?,
        collabIds: List<String>
    ) = withContext(Dispatchers.IO) {
        val cleanCollabs = collabIds.filter { it.isNotBlank() && it != primaryChannelId }.joinToString(",")
        for (k in videoKeys) {
            val v = dao.getVideoByKey(k)
            if (v != null) {
                dao.insertVideo(v.copy(channelId = primaryChannelId, collabChannelIds = cleanCollabs))
            }
        }
    }

    // --- Custom Thumbnail Support ---
    suspend fun setCustomThumbnail(videoKey: String, thumbnailUri: String) = withContext(Dispatchers.IO) {
        val v = dao.getVideoByKey(videoKey) ?: return@withContext
        dao.insertVideo(v.copy(thumbnailUri = thumbnailUri, isCustomThumbnail = true))
    }

    suspend fun resetThumbnail(videoKey: String) = withContext(Dispatchers.IO) {
        val v = dao.getVideoByKey(videoKey) ?: return@withContext
        dao.insertVideo(v.copy(thumbnailUri = null, isCustomThumbnail = false))
    }

    // --- Tag Operations ---
    suspend fun addTagToVideo(videoKey: String, rawTag: String) = withContext(Dispatchers.IO) {
        val cleanTag = rawTag.trim().removePrefix("#")
        if (cleanTag.isBlank()) return@withContext
        val v = dao.getVideoByKey(videoKey) ?: return@withContext
        val currentTags = v.tags.split(",").map { it.trim() }.filter { it.isNotBlank() }.toMutableList()
        if (!currentTags.any { it.equals(cleanTag, ignoreCase = true) }) {
            currentTags.add(cleanTag)
            val isShort = currentTags.any { it.equals("shorts", ignoreCase = true) } || v.isShort
            dao.insertVideo(v.copy(tags = currentTags.joinToString(","), isShort = isShort))
        }
    }

    suspend fun removeTagFromVideo(videoKey: String, tag: String) = withContext(Dispatchers.IO) {
        val cleanTag = tag.trim().removePrefix("#")
        val v = dao.getVideoByKey(videoKey) ?: return@withContext
        val currentTags = v.tags.split(",").map { it.trim() }.filter { it.isNotBlank() && !it.equals(cleanTag, ignoreCase = true) }
        val isShort = currentTags.any { it.equals("shorts", ignoreCase = true) }
        dao.insertVideo(v.copy(tags = currentTags.joinToString(","), isShort = isShort))
    }

    suspend fun batchAddTag(videoKeys: List<String>, rawTag: String) = withContext(Dispatchers.IO) {
        val cleanTag = rawTag.trim().removePrefix("#")
        if (cleanTag.isBlank()) return@withContext
        for (k in videoKeys) {
            val v = dao.getVideoByKey(k) ?: continue
            val currentTags = v.tags.split(",").map { it.trim() }.filter { it.isNotBlank() }.toMutableList()
            if (!currentTags.any { it.equals(cleanTag, ignoreCase = true) }) {
                currentTags.add(cleanTag)
                dao.insertVideo(v.copy(tags = currentTags.joinToString(",")))
            }
        }
    }

    suspend fun deleteTagGlobally(tag: String) = withContext(Dispatchers.IO) {
        val cleanTag = tag.trim().removePrefix("#")
        val videos = dao.getAllVideos().first()
        val toUpdate = mutableListOf<VideoEntity>()
        for (v in videos) {
            val currentTags = v.tags.split(",").map { it.trim() }.filter { it.isNotBlank() }
            if (currentTags.any { it.equals(cleanTag, ignoreCase = true) }) {
                val filtered = currentTags.filter { !it.equals(cleanTag, ignoreCase = true) }
                toUpdate.add(v.copy(tags = filtered.joinToString(",")))
            }
        }
        if (toUpdate.isNotEmpty()) {
            dao.insertVideos(toUpdate)
        }
    }

    // --- Playlist Operations ---
    suspend fun createPlaylist(name: String): PlaylistItem = withContext(Dispatchers.IO) {
        val id = "pl_${System.currentTimeMillis()}_${(100..999).random()}"
        val entity = PlaylistEntity(
            id = id,
            name = name.trim(),
            createdAt = System.currentTimeMillis(),
            videoKeysJson = "[]"
        )
        dao.insertPlaylist(entity)
        entity.toDomain()
    }

    suspend fun toggleVideoInPlaylist(playlistId: String, videoKey: String) = withContext(Dispatchers.IO) {
        val playlists = dao.getAllPlaylists().first()
        val pl = playlists.find { it.id == playlistId } ?: return@withContext
        val keys = try {
            val arr = JSONArray(pl.videoKeysJson)
            val list = mutableListOf<String>()
            for (i in 0 until arr.length()) list.add(arr.getString(i))
            list
        } catch (e: Exception) {
            mutableListOf()
        }

        if (keys.contains(videoKey)) {
            keys.remove(videoKey)
        } else {
            keys.add(videoKey)
        }

        val newJson = JSONArray(keys).toString()
        dao.insertPlaylist(pl.copy(videoKeysJson = newJson))
    }

    suspend fun deletePlaylist(playlistId: String) = withContext(Dispatchers.IO) {
        dao.deletePlaylist(playlistId)
    }

    // --- Watch Progress ---
    suspend fun saveProgress(videoKey: String, currentTimeMs: Long, durationMs: Long) = withContext(Dispatchers.IO) {
        val completed = durationMs > 0 && currentTimeMs >= durationMs - 3000L
        val entity = WatchProgressEntity(
            videoKey = videoKey,
            currentTimeMs = if (completed) 0L else currentTimeMs,
            durationMs = durationMs,
            completed = completed,
            updatedAt = System.currentTimeMillis()
        )
        dao.saveWatchProgress(entity)
    }

    // --- Watch History ---
    suspend fun recordHistory(videoKey: String) = withContext(Dispatchers.IO) {
        dao.insertWatchHistory(
            WatchHistoryEntity(
                videoKey = videoKey,
                watchedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun deleteHistoryForVideo(videoKey: String) = withContext(Dispatchers.IO) {
        dao.deleteWatchHistoryByVideo(videoKey)
    }

    suspend fun clearHistory() = withContext(Dispatchers.IO) {
        dao.clearWatchHistory()
    }

    // --- Likes / Dislikes / Watch Later ---
    suspend fun toggleLike(videoKey: String) = withContext(Dispatchers.IO) {
        val cur = dao.getInteraction(videoKey) ?: UserInteractionEntity(videoKey = videoKey)
        val newLiked = !cur.isLiked
        dao.saveInteraction(cur.copy(isLiked = newLiked, isDisliked = if (newLiked) false else cur.isDisliked))
    }

    suspend fun toggleDislike(videoKey: String) = withContext(Dispatchers.IO) {
        val cur = dao.getInteraction(videoKey) ?: UserInteractionEntity(videoKey = videoKey)
        val newDisliked = !cur.isDisliked
        dao.saveInteraction(cur.copy(isDisliked = newDisliked, isLiked = if (newDisliked) false else cur.isLiked))
    }

    suspend fun toggleWatchLater(videoKey: String) = withContext(Dispatchers.IO) {
        val cur = dao.getInteraction(videoKey) ?: UserInteractionEntity(videoKey = videoKey)
        dao.saveInteraction(cur.copy(isWatchLater = !cur.isWatchLater))
    }

    // --- Search History ---
    suspend fun addSearchQuery(query: String) = withContext(Dispatchers.IO) {
        val q = query.trim()
        if (q.length < 2) return@withContext
        dao.deleteSearchQuery(q)
        dao.insertSearchQuery(SearchHistoryEntity(query = q, timestamp = System.currentTimeMillis()))
    }

    suspend fun removeSearchQuery(query: String) = withContext(Dispatchers.IO) {
        dao.deleteSearchQuery(query)
    }

    // --- Preferences ---
    suspend fun setPreference(key: String, value: String) = withContext(Dispatchers.IO) {
        dao.setPreference(AppPreferenceEntity(key, value))
    }

    // --- JSON Portability Export / Import (Matches LocalTube Web Format) ---
    suspend fun exportMetadataJson(): String = withContext(Dispatchers.IO) {
        val channels = dao.getAllChannels().first()
        val videos = dao.getAllVideos().first()
        val playlists = dao.getAllPlaylists().first()
        val progress = dao.getAllWatchProgress().first()
        val interactions = dao.getAllInteractions().first()
        val history = dao.getWatchHistory().first()

        val root = JSONObject()
        root.put("app", "LocalTube")
        root.put("version", "1.0")
        root.put("exportedAt", System.currentTimeMillis())

        val channelsArray = JSONArray()
        for (c in channels) {
            val obj = JSONObject()
            obj.put("id", c.id)
            obj.put("name", c.name)
            obj.put("handle", c.handle)
            obj.put("color", c.colorHex)
            obj.put("description", c.description)
            if (c.logoUri != null) obj.put("logo", c.logoUri)
            obj.put("createdAt", c.createdAt)
            channelsArray.put(obj)
        }
        root.put("channels", channelsArray)

        val videoChannelsObj = JSONObject()
        val videoCollabsObj = JSONObject()
        val tagsObj = JSONObject()

        for (v in videos) {
            if (v.channelId != null) {
                videoChannelsObj.put(v.key, v.channelId)
            }
            if (v.collabChannelIds.isNotBlank()) {
                val collabs = JSONArray(v.collabChannelIds.split(","))
                videoCollabsObj.put(v.key, collabs)
            }
            if (v.tags.isNotBlank()) {
                val tagsArr = JSONArray(v.tags.split(","))
                tagsObj.put(v.key, tagsArr)
            }
        }
        root.put("videoChannels", videoChannelsObj)
        root.put("videoCollabs", videoCollabsObj)
        root.put("tags", tagsObj)

        val playlistsArray = JSONArray()
        for (p in playlists) {
            val obj = JSONObject()
            obj.put("id", p.id)
            obj.put("name", p.name)
            obj.put("createdAt", p.createdAt)
            obj.put("videoKeys", JSONArray(p.videoKeysJson))
            playlistsArray.put(obj)
        }
        root.put("playlists", playlistsArray)

        val subscriptionsArray = JSONArray()
        for (c in channels.filter { it.isSubscribed }) {
            subscriptionsArray.put(c.id)
        }
        root.put("subscriptions", subscriptionsArray)

        val likesArray = JSONArray()
        val dislikesArray = JSONArray()
        val watchLaterArray = JSONArray()
        for (i in interactions) {
            if (i.isLiked) likesArray.put(i.videoKey)
            if (i.isDisliked) dislikesArray.put(i.videoKey)
            if (i.isWatchLater) watchLaterArray.put(i.videoKey)
        }
        root.put("likes", likesArray)
        root.put("dislikes", dislikesArray)
        root.put("watchLater", watchLaterArray)

        root.toString(2)
    }

    suspend fun importMetadataJson(jsonText: String): String = withContext(Dispatchers.IO) {
        val root = JSONObject(jsonText)
        var channelsCount = 0
        var playlistsCount = 0

        if (root.has("channels")) {
            val arr = root.getJSONArray("channels")
            val entities = mutableListOf<ChannelEntity>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val id = obj.optString("id", "ch_${System.currentTimeMillis()}_$i")
                val name = obj.optString("name", "Channel")
                val handle = obj.optString("handle", "@$name")
                val color = obj.optString("color", "#FF0000")
                val desc = obj.optString("description", "")
                val logo = if (obj.has("logo")) obj.getString("logo") else null
                val createdAt = obj.optLong("createdAt", System.currentTimeMillis())

                entities.add(
                    ChannelEntity(
                        id = id,
                        name = name,
                        handle = handle,
                        colorHex = color,
                        description = desc,
                        logoUri = logo,
                        createdAt = createdAt,
                        isSubscribed = true
                    )
                )
                channelsCount++
            }
            dao.insertChannels(entities)
        }

        if (root.has("playlists")) {
            val arr = root.getJSONArray("playlists")
            val pEntities = mutableListOf<PlaylistEntity>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val id = obj.optString("id", "pl_${System.currentTimeMillis()}_$i")
                val name = obj.optString("name", "Playlist")
                val keys = obj.optJSONArray("videoKeys")?.toString() ?: "[]"
                pEntities.add(
                    PlaylistEntity(
                        id = id,
                        name = name,
                        createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
                        videoKeysJson = keys
                    )
                )
                playlistsCount++
            }
            dao.insertPlaylists(pEntities)
        }

        // Apply videoChannels, tags, etc.
        val videos = dao.getAllVideos().first()
        val videoChannelsObj = root.optJSONObject("videoChannels")
        val collabsObj = root.optJSONObject("videoCollabs")
        val tagsObj = root.optJSONObject("tags")

        val updatedVideos = mutableListOf<VideoEntity>()
        for (v in videos) {
            var newChId = v.channelId
            var newCollabs = v.collabChannelIds
            var newTags = v.tags

            if (videoChannelsObj != null && videoChannelsObj.has(v.key)) {
                newChId = videoChannelsObj.getString(v.key)
            }
            if (collabsObj != null && collabsObj.has(v.key)) {
                val arr = collabsObj.getJSONArray(v.key)
                val list = mutableListOf<String>()
                for (j in 0 until arr.length()) list.add(arr.getString(j))
                newCollabs = list.joinToString(",")
            }
            if (tagsObj != null && tagsObj.has(v.key)) {
                val arr = tagsObj.getJSONArray(v.key)
                val list = mutableListOf<String>()
                for (j in 0 until arr.length()) list.add(arr.getString(j))
                newTags = list.joinToString(",")
            }

            if (newChId != v.channelId || newCollabs != v.collabChannelIds || newTags != v.tags) {
                updatedVideos.add(v.copy(channelId = newChId, collabChannelIds = newCollabs, tags = newTags))
            }
        }

        if (updatedVideos.isNotEmpty()) {
            dao.insertVideos(updatedVideos)
        }

        "Successfully imported $channelsCount channels & $playlistsCount playlists!"
    }

    // --- Helpers ---
    private fun VideoEntity.toDomain() = VideoItem(
        key = key,
        name = name,
        title = title,
        uriString = uriString,
        size = size,
        formattedSize = formattedSize,
        durationMs = durationMs,
        formattedDuration = formattedDuration,
        ext = ext,
        isShort = isShort,
        channelId = channelId,
        collabChannelIds = if (collabChannelIds.isBlank()) emptyList() else collabChannelIds.split(","),
        tags = if (tags.isBlank()) emptyList() else tags.split(",").map { it.trim() },
        thumbnailUri = thumbnailUri,
        isCustomThumbnail = isCustomThumbnail,
        dateAdded = dateAdded
    )

    private fun ChannelEntity.toDomain() = ChannelItem(
        id = id,
        name = name,
        handle = handle,
        colorHex = colorHex,
        description = description,
        logoUri = logoUri,
        createdAt = createdAt,
        isSubscribed = isSubscribed
    )

    private fun PlaylistEntity.toDomain(): PlaylistItem {
        val keys = try {
            val arr = JSONArray(videoKeysJson)
            val list = mutableListOf<String>()
            for (i in 0 until arr.length()) list.add(arr.getString(i))
            list
        } catch (e: Exception) {
            emptyList()
        }
        return PlaylistItem(
            id = id,
            name = name,
            createdAt = createdAt,
            videoKeys = keys
        )
    }

    private fun WatchProgressEntity.toDomain() = WatchProgressItem(
        videoKey = videoKey,
        currentTimeMs = currentTimeMs,
        durationMs = durationMs,
        completed = completed,
        updatedAt = updatedAt
    )

    private fun cleanTitle(filename: String): String {
        return filename
            .replace(Regex("\\.(mp4|webm|mkv|mov|avi|m4v|ogg|3gp)$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("[._-]+"), " ")
            .trim()
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val k = 1024.0
        val sizes = arrayOf("B", "KB", "MB", "GB")
        val i = (Math.log(bytes.toDouble()) / Math.log(k)).toInt().coerceIn(0, 3)
        return String.format(Locale.US, "%.1f %s", bytes / Math.pow(k, i.toDouble()), sizes[i])
    }

    private fun formatDuration(durationMs: Long): String {
        if (durationMs <= 0) return "0:00"
        val totalSecs = durationMs / 1000
        val mins = totalSecs / 60
        val secs = totalSecs % 60
        return if (mins >= 60) {
            val hrs = mins / 60
            val remMins = mins % 60
            String.format(Locale.US, "%d:%02d:%02d", hrs, remMins, secs)
        } else {
            String.format(Locale.US, "%d:%02d", mins, secs)
        }
    }
}
