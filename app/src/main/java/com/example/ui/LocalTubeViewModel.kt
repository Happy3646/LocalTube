package com.example.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.LocalTubeDatabase
import com.example.data.local.UserInteractionEntity
import com.example.data.model.*
import com.example.data.repository.LocalTubeRepository
import com.example.player.LocalTubePlayerManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

data class SearchSuggestion(
    val type: SuggestionType,
    val title: String,
    val subtitle: String? = null,
    val channelId: String? = null,
    val colorHex: String? = null,
    val logoUri: String? = null
)

enum class SuggestionType {
    HISTORY,
    TAG,
    CHANNEL,
    TITLE
}

data class DuplicateGroup(
    val phrase: String,
    val videos: List<VideoItem>
)

data class LocalTubeUiState(
    val allVideos: List<VideoItem> = emptyList(),
    val filteredVideos: List<VideoItem> = emptyList(),
    val channels: List<ChannelItem> = emptyList(),
    val playlists: List<PlaylistItem> = emptyList(),
    val watchProgress: Map<String, WatchProgressItem> = emptyMap(),
    val watchHistory: List<WatchHistoryItem> = emptyList(),
    val userInteractions: Map<String, UserInteractionEntity> = emptyMap(),
    val currentView: MainView = MainView.ALL,
    val activeChannelId: String? = null,
    val activePlaylistId: String? = null,
    val selectedTagFilter: String? = null,
    val searchQuery: String = "",
    val searchHistory: List<String> = emptyList(),
    val searchSuggestions: List<SearchSuggestion> = emptyList(),
    val isShuffled: Boolean = false,
    val currentSort: VideoSort = VideoSort.NONE,
    val activeVideo: VideoItem? = null,
    val upNextQueue: List<VideoItem> = emptyList(),
    val autoplayEnabled: Boolean = true,
    val resumeToastMessage: String? = null,
    val selectedVideoKeys: Set<String> = emptySet(),
    val isDarkMode: Boolean = true,
    val gridColumns: Int = 2,
    val duplicateThreshold: Int = 4,
    val duplicateGroups: List<DuplicateGroup> = emptyList(),
    val toastMessage: String? = null,
    val isScanningDevice: Boolean = false
)

class LocalTubeViewModel(application: Application) : AndroidViewModel(application) {

    private val database = LocalTubeDatabase.getDatabase(application)
    val repository = LocalTubeRepository(application, database.localTubeDao())
    val playerManager = LocalTubePlayerManager(application)

    private val _uiState = MutableStateFlow(LocalTubeUiState())
    val uiState: StateFlow<LocalTubeUiState> = _uiState.asStateFlow()

    private val shuffleSeed = MutableStateFlow(0L)

    init {
        viewModelScope.launch {
            repository.initializeDefaultsIfNeeded()
        }

        viewModelScope.launch {
            combine(repository.allVideos, repository.allChannels, repository.allPlaylists) { v, c, p ->
                Triple(v, c, p)
            }.collect { (v, c, p) ->
                _uiState.update { it.copy(allVideos = v, channels = c, playlists = p) }
                recalculateFilteredVideos()
            }
        }

        viewModelScope.launch {
            combine(repository.allWatchProgress, repository.watchHistory, repository.userInteractions) { prog, hist, inter ->
                Triple(prog, hist, inter)
            }.collect { (prog, hist, inter) ->
                _uiState.update { it.copy(watchProgress = prog, watchHistory = hist, userInteractions = inter) }
            }
        }

        viewModelScope.launch {
            repository.searchHistory.collect { sHistory ->
                _uiState.update { it.copy(searchHistory = sHistory) }
            }
        }

        viewModelScope.launch {
            repository.appPreferences.collect { prefs ->
                val darkTheme = prefs["theme"]?.let { it == "dark" } ?: true
                val cols = prefs["grid_cols"]?.toIntOrNull()?.coerceIn(1, 4) ?: 2
                val dupThreshold = prefs["dup_threshold"]?.toIntOrNull()?.coerceIn(3, 6) ?: 4
                val autoplay = prefs["autoplay"]?.let { it == "true" } ?: true
                _uiState.update {
                    it.copy(
                        isDarkMode = darkTheme,
                        gridColumns = cols,
                        duplicateThreshold = dupThreshold,
                        autoplayEnabled = autoplay
                    )
                }
            }
        }

        // Setup player listeners
        playerManager.onVideoEnded = {
            if (_uiState.value.autoplayEnabled) {
                playNextVideo()
            }
        }

        playerManager.onProgressTick = { currentMs, durationMs ->
            val active = _uiState.value.activeVideo
            if (active != null && durationMs > 0) {
                viewModelScope.launch {
                    repository.saveProgress(active.key, currentMs, durationMs)
                }
            }
        }
    }

    // --- Video Selection & Filtering ---
    fun selectView(view: MainView) {
        _uiState.update {
            it.copy(
                currentView = view,
                activeChannelId = if (view == MainView.CHANNEL) it.activeChannelId else null,
                activePlaylistId = if (view == MainView.PLAYLIST) it.activePlaylistId else null,
                selectedVideoKeys = if (view == MainView.UNTAGGED || view == MainView.VIDEOS_WITHOUT_CHANNEL) it.selectedVideoKeys else emptySet()
            )
        }
        recalculateFilteredVideos()
    }

    fun openChannel(channelId: String) {
        _uiState.update {
            it.copy(
                currentView = MainView.CHANNEL,
                activeChannelId = channelId,
                activePlaylistId = null,
                selectedTagFilter = null
            )
        }
        recalculateFilteredVideos()
    }

    fun openPlaylist(playlistId: String) {
        _uiState.update {
            it.copy(
                currentView = MainView.PLAYLIST,
                activePlaylistId = playlistId,
                activeChannelId = null,
                selectedTagFilter = null
            )
        }
        recalculateFilteredVideos()
    }

    fun selectTagFilter(tag: String?) {
        val clean = tag?.trim()?.removePrefix("#")
        _uiState.update {
            it.copy(
                selectedTagFilter = if (it.selectedTagFilter == clean) null else clean
            )
        }
        recalculateFilteredVideos()
    }

    fun updateSearchQuery(query: String) {
        _uiState.update {
            it.copy(searchQuery = query)
        }
        generateSearchSuggestions(query)
        recalculateFilteredVideos()
    }

    fun executeSearch(query: String) {
        val clean = query.trim()
        if (clean.isNotBlank()) {
            viewModelScope.launch {
                repository.addSearchQuery(clean)
            }
        }
        if (clean.startsWith("#")) {
            selectTagFilter(clean.removePrefix("#"))
            return
        }
        _uiState.update {
            it.copy(searchQuery = clean)
        }
        recalculateFilteredVideos()
    }

    fun clearSearch() {
        _uiState.update {
            it.copy(searchQuery = "", searchSuggestions = emptyList())
        }
        recalculateFilteredVideos()
    }

    fun setSort(sort: VideoSort) {
        _uiState.update {
            it.copy(
                currentSort = if (it.currentSort == sort) VideoSort.NONE else sort,
                isShuffled = false
            )
        }
        recalculateFilteredVideos()
    }

    fun toggleShuffle() {
        _uiState.update {
            it.copy(
                isShuffled = !it.isShuffled,
                currentSort = VideoSort.NONE
            )
        }
        shuffleSeed.value = System.currentTimeMillis()
        recalculateFilteredVideos()
    }

    private fun recalculateFilteredVideos() {
        val state = _uiState.value
        val all = state.allVideos
        var list = when (state.currentView) {
            MainView.ALL -> all.filter { !it.isShort }
            MainView.LIKED -> all.filter { state.userInteractions[it.key]?.isLiked == true }
            MainView.WATCH_LATER -> all.filter { state.userInteractions[it.key]?.isWatchLater == true }
            MainView.UNTAGGED -> all.filter { it.tags.isEmpty() }
            MainView.SHORTS -> all.filter { it.isShort || it.tags.any { t -> t.equals("shorts", ignoreCase = true) } }
            MainView.HISTORY -> {
                val histKeys = state.watchHistory.map { it.videoKey }.toSet()
                all.filter { histKeys.contains(it.key) }
            }
            MainView.PLAYLIST -> {
                val pl = state.playlists.find { it.id == state.activePlaylistId }
                if (pl != null) all.filter { pl.videoKeys.contains(it.key) } else emptyList()
            }
            MainView.CHANNEL -> {
                val chId = state.activeChannelId
                if (chId != null) {
                    all.filter { it.channelId == chId || it.collabChannelIds.contains(chId) }
                } else emptyList()
            }
            MainView.ALL_CHANNELS -> emptyList()
            MainView.SUBSCRIBED_CHANNELS -> {
                val subIds = state.channels.filter { it.isSubscribed }.map { it.id }.toSet()
                all.filter { v -> (v.channelId != null && subIds.contains(v.channelId)) || v.collabChannelIds.any { subIds.contains(it) } }
            }
            MainView.VIDEOS_WITHOUT_CHANNEL -> all.filter { it.channelId == null && it.collabChannelIds.isEmpty() }
            MainView.SETTINGS -> emptyList()
        }

        // Apply Tag Filter
        state.selectedTagFilter?.let { tag ->
            list = list.filter { v ->
                v.tags.any { it.equals(tag, ignoreCase = true) }
            }
        }

        // Apply Search Filter
        val q = state.searchQuery.trim().lowercase(Locale.ROOT)
        if (q.isNotBlank()) {
            val qClean = q.removePrefix("#").removePrefix("@")
            list = list.filter { v ->
                val titleMatch = v.title.lowercase(Locale.ROOT).contains(q) || v.title.lowercase(Locale.ROOT).contains(qClean)
                val tagMatch = v.tags.any { it.lowercase(Locale.ROOT).contains(qClean) }
                val channel = state.channels.find { it.id == v.channelId }
                val channelMatch = channel?.let {
                    it.name.lowercase(Locale.ROOT).contains(qClean) || it.handle.lowercase(Locale.ROOT).contains(qClean)
                } ?: false
                titleMatch || tagMatch || channelMatch
            }
        }

        // Sort or Shuffle
        list = if (state.isShuffled) {
            val rng = java.util.Random(shuffleSeed.value)
            list.shuffled(rng)
        } else {
            when (state.currentSort) {
                VideoSort.NAME -> list.sortedBy { it.title.lowercase(Locale.ROOT) }
                VideoSort.SIZE -> list.sortedByDescending { it.size }
                VideoSort.NONE -> {
                    // Smart subscription prioritization
                    val subIds = state.channels.filter { it.isSubscribed }.map { it.id }.toSet()
                    list.sortedByDescending { v ->
                        if (v.channelId != null && subIds.contains(v.channelId)) 1 else 0
                    }
                }
            }
        }

        _uiState.update { it.copy(filteredVideos = list) }
    }

    private fun generateSearchSuggestions(query: String) {
        val q = query.trim().lowercase(Locale.ROOT)
        val qClean = q.removePrefix("#").removePrefix("@")
        val state = _uiState.value
        val suggestions = mutableListOf<SearchSuggestion>()

        if (q.isBlank()) {
            // Recent search history
            state.searchHistory.take(5).forEach {
                suggestions.add(SearchSuggestion(SuggestionType.HISTORY, it))
            }
            // Channels
            state.channels.take(3).forEach {
                suggestions.add(SearchSuggestion(SuggestionType.CHANNEL, it.name, it.handle, it.id, it.colorHex, it.logoUri))
            }
        } else {
            // Matching channels
            state.channels.filter {
                it.name.lowercase(Locale.ROOT).contains(qClean) || it.handle.lowercase(Locale.ROOT).contains(qClean)
            }.take(3).forEach {
                suggestions.add(SearchSuggestion(SuggestionType.CHANNEL, it.name, it.handle, it.id, it.colorHex, it.logoUri))
            }

            // Matching tags
            val allTags = state.allVideos.flatMap { it.tags }.distinct()
            allTags.filter { it.lowercase(Locale.ROOT).contains(qClean) }.take(4).forEach {
                suggestions.add(SearchSuggestion(SuggestionType.TAG, "#$it"))
            }

            // Matching history
            state.searchHistory.filter { it.lowercase(Locale.ROOT).contains(q) }.take(3).forEach {
                suggestions.add(SearchSuggestion(SuggestionType.HISTORY, it))
            }

            // Matching video titles
            state.allVideos.filter { it.title.lowercase(Locale.ROOT).contains(q) }.take(4).forEach {
                suggestions.add(SearchSuggestion(SuggestionType.TITLE, it.title))
            }
        }

        _uiState.update { it.copy(searchSuggestions = suggestions.distinctBy { s -> s.title }) }
    }

    // --- Playback Handling ---
    fun playVideo(video: VideoItem) {
        val state = _uiState.value
        val progress = state.watchProgress[video.key]
        val startPosition = if (progress != null && !progress.completed && progress.currentTimeMs > 2000L) {
            progress.currentTimeMs
        } else 0L

        var resumeMessage: String? = null
        if (startPosition > 2000L) {
            val secs = (startPosition / 1000) % 60
            val mins = (startPosition / 60000)
            resumeMessage = "Resumed from $mins:${if (secs < 10) "0$secs" else "$secs"}"
        }

        // Build up next queue
        val queue = state.allVideos.filter { it.key != video.key }
        val upNext = if (state.isShuffled) queue.shuffled() else queue

        _uiState.update {
            it.copy(
                activeVideo = video,
                upNextQueue = upNext,
                resumeToastMessage = resumeMessage
            )
        }

        playerManager.playVideo(video.uriString, startPosition)

        viewModelScope.launch {
            repository.recordHistory(video.key)
        }
    }

    fun playNextVideo() {
        val state = _uiState.value
        val next = state.upNextQueue.firstOrNull()
        if (next != null) {
            playVideo(next)
        }
    }

    fun playPreviousVideo() {
        val state = _uiState.value
        val all = state.allVideos
        val currentIndex = all.indexOfFirst { it.key == state.activeVideo?.key }
        if (currentIndex > 0) {
            playVideo(all[currentIndex - 1])
        } else if (all.isNotEmpty()) {
            playVideo(all.last())
        }
    }

    fun closePlayer() {
        playerManager.getPlayer()?.pause()
        _uiState.update { it.copy(activeVideo = null, resumeToastMessage = null) }
    }

    fun mixUpNextQueue() {
        _uiState.update {
            it.copy(upNextQueue = it.upNextQueue.shuffled())
        }
    }

    fun setAutoplay(enabled: Boolean) {
        _uiState.update { it.copy(autoplayEnabled = enabled) }
        viewModelScope.launch {
            repository.setPreference("autoplay", enabled.toString())
        }
    }

    // --- Likes / Dislikes / Watch Later ---
    fun toggleLike(videoKey: String) {
        viewModelScope.launch {
            repository.toggleLike(videoKey)
        }
    }

    fun toggleDislike(videoKey: String) {
        viewModelScope.launch {
            repository.toggleDislike(videoKey)
        }
    }

    fun toggleWatchLater(videoKey: String) {
        viewModelScope.launch {
            repository.toggleWatchLater(videoKey)
            showToast("Watch Later updated")
        }
    }

    // --- Channels Actions ---
    fun toggleChannelSubscription(channelId: String) {
        viewModelScope.launch {
            repository.toggleSubscription(channelId)
            val ch = _uiState.value.channels.find { it.id == channelId }
            if (ch != null) {
                showToast(if (!ch.isSubscribed) "Subscribed to ${ch.name}" else "Unsubscribed from ${ch.name}")
            }
        }
    }

    fun createChannel(name: String, handle: String?, colorHex: String, description: String, logoUri: String? = null) {
        viewModelScope.launch {
            val newCh = repository.createChannel(name, handle, colorHex, description, logoUri)
            openChannel(newCh.id)
            showToast("Channel '${newCh.name}' created!")
        }
    }

    fun updateChannel(id: String, name: String, handle: String, colorHex: String, description: String, logoUri: String?) {
        viewModelScope.launch {
            repository.updateChannel(id, name, handle, colorHex, description, logoUri)
            showToast("Channel updated!")
        }
    }

    fun deleteChannel(channelId: String) {
        viewModelScope.launch {
            val ch = _uiState.value.channels.find { it.id == channelId }
            repository.deleteChannel(channelId)
            if (_uiState.value.activeChannelId == channelId) {
                selectView(MainView.ALL_CHANNELS)
            }
            showToast("Deleted channel ${ch?.name ?: ""}")
        }
    }

    fun assignVideoChannel(videoKey: String, primaryId: String?, collabIds: List<String>) {
        viewModelScope.launch {
            repository.assignVideoToChannel(videoKey, primaryId, collabIds)
            showToast("Channel assignment saved!")
        }
    }

    fun setVideoCustomThumbnail(videoKey: String, thumbnailUri: String) {
        viewModelScope.launch {
            repository.setCustomThumbnail(videoKey, thumbnailUri)
            showToast("Custom thumbnail saved!")
        }
    }

    fun resetVideoThumbnail(videoKey: String) {
        viewModelScope.launch {
            repository.resetThumbnail(videoKey)
            showToast("Thumbnail reset to default frame")
        }
    }

    // --- Tags Actions ---
    fun addTag(videoKey: String, tag: String) {
        viewModelScope.launch {
            repository.addTagToVideo(videoKey, tag)
        }
    }

    fun removeTag(videoKey: String, tag: String) {
        viewModelScope.launch {
            repository.removeTagFromVideo(videoKey, tag)
        }
    }

    fun deleteTagGlobally(tag: String) {
        viewModelScope.launch {
            repository.deleteTagGlobally(tag)
            if (_uiState.value.selectedTagFilter == tag) {
                selectTagFilter(null)
            }
            showToast("Deleted tag '#$tag' from all videos")
        }
    }

    // --- Playlists Actions ---
    fun createPlaylist(name: String) {
        viewModelScope.launch {
            val pl = repository.createPlaylist(name)
            showToast("Created playlist '${pl.name}'")
        }
    }

    fun toggleVideoInPlaylist(playlistId: String, videoKey: String) {
        viewModelScope.launch {
            repository.toggleVideoInPlaylist(playlistId, videoKey)
        }
    }

    fun deletePlaylist(playlistId: String) {
        viewModelScope.launch {
            repository.deletePlaylist(playlistId)
            if (_uiState.value.activePlaylistId == playlistId) {
                selectView(MainView.ALL)
            }
            showToast("Playlist deleted")
        }
    }

    // --- Multi-Select Batch Operations ---
    fun toggleVideoSelection(videoKey: String) {
        _uiState.update { current ->
            val set = current.selectedVideoKeys.toMutableSet()
            if (set.contains(videoKey)) set.remove(videoKey) else set.add(videoKey)
            current.copy(selectedVideoKeys = set)
        }
    }

    fun selectAllVisibleVideos() {
        val keys = _uiState.value.filteredVideos.map { it.key }.toSet()
        _uiState.update { it.copy(selectedVideoKeys = keys) }
        showToast("Selected all ${keys.size} visible videos")
    }

    fun clearVideoSelection() {
        _uiState.update { it.copy(selectedVideoKeys = emptySet()) }
    }

    fun deleteHistoryForVideo(videoKey: String) {
        viewModelScope.launch {
            repository.deleteHistoryForVideo(videoKey)
            showToast("Removed from history")
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            repository.clearHistory()
            showToast("Watch history cleared")
        }
    }

    fun removeSearchQuery(query: String) {
        viewModelScope.launch {
            repository.removeSearchQuery(query)
        }
    }

    fun batchAssignChannel(primaryId: String?, collabIds: List<String>) {
        val keys = _uiState.value.selectedVideoKeys.toList()
        if (keys.isEmpty()) return
        viewModelScope.launch {
            repository.batchAssignVideosToChannel(keys, primaryId, collabIds)
            clearVideoSelection()
            showToast("Assigned ${keys.size} videos to channel")
        }
    }

    fun batchAddTag(tag: String) {
        val keys = _uiState.value.selectedVideoKeys.toList()
        if (keys.isEmpty()) return
        viewModelScope.launch {
            repository.batchAddTag(keys, tag)
            clearVideoSelection()
            showToast("Added '#$tag' to ${keys.size} videos")
        }
    }

    // --- Duplicate Detector (3..6 Words) ---
    fun scanDuplicates() {
        viewModelScope.launch(Dispatchers.Default) {
            val n = _uiState.value.duplicateThreshold
            val videos = _uiState.value.allVideos

            val nGramsMap = mutableMapOf<String, MutableList<VideoItem>>()

            for (video in videos) {
                val clean = video.title.lowercase(Locale.ROOT)
                    .replace(Regex("[^a-z0-9\\s]"), " ")
                    .replace(Regex("\\s+"), " ")
                    .trim()
                val words = clean.split(" ").filter { it.length > 1 }
                if (words.size >= n) {
                    for (i in 0..words.size - n) {
                        val gram = words.subList(i, i + n).joinToString(" ")
                        val list = nGramsMap.getOrPut(gram) { mutableListOf() }
                        if (list.none { it.key == video.key }) {
                            list.add(video)
                        }
                    }
                }
            }

            val duplicateGroups = nGramsMap.filter { it.value.size >= 2 }
                .map { DuplicateGroup(it.key, it.value) }

            _uiState.update { it.copy(duplicateGroups = duplicateGroups) }
        }
    }

    fun setDuplicateThreshold(words: Int) {
        _uiState.update { it.copy(duplicateThreshold = words) }
        viewModelScope.launch {
            repository.setPreference("dup_threshold", words.toString())
        }
        scanDuplicates()
    }

    // --- Media Scanning & Storage ---
    fun scanDeviceVideos() {
        _uiState.update { it.copy(isScanningDevice = true) }
        viewModelScope.launch {
            val count = repository.scanDeviceMediaVideos()
            _uiState.update { it.copy(isScanningDevice = false) }
            showToast("Discovered $count local videos on device!")
        }
    }

    fun importVideosFromUris(uris: List<Uri>) {
        viewModelScope.launch {
            val count = repository.importVideosFromUris(uris)
            showToast("Imported $count video files into LocalTube!")
        }
    }

    // --- Settings & Preferences ---
    fun toggleDarkMode() {
        val newMode = !_uiState.value.isDarkMode
        _uiState.update { it.copy(isDarkMode = newMode) }
        viewModelScope.launch {
            repository.setPreference("theme", if (newMode) "dark" else "light")
        }
    }

    fun setGridColumns(cols: Int) {
        _uiState.update { it.copy(gridColumns = cols.coerceIn(1, 4)) }
        viewModelScope.launch {
            repository.setPreference("grid_cols", cols.toString())
        }
    }

    // --- Portability (Export/Import JSON) ---
    suspend fun getExportJson(): String = repository.exportMetadataJson()

    fun importJsonMetadata(json: String) {
        viewModelScope.launch {
            try {
                val msg = repository.importMetadataJson(json)
                showToast(msg)
            } catch (e: Exception) {
                showToast("Failed to import JSON: ${e.message}")
            }
        }
    }

    fun showToast(message: String) {
        _uiState.update { it.copy(toastMessage = message) }
    }

    fun dismissToast() {
        _uiState.update { it.copy(toastMessage = null) }
    }

    override fun onCleared() {
        super.onCleared()
        playerManager.release()
    }
}
