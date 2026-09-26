package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface LocalTubeDao {

    // --- Videos ---
    @Query("SELECT * FROM videos ORDER BY dateAdded DESC")
    fun getAllVideos(): Flow<List<VideoEntity>>

    @Query("SELECT * FROM videos WHERE `key` = :videoKey LIMIT 1")
    suspend fun getVideoByKey(videoKey: String): VideoEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVideos(videos: List<VideoEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVideo(video: VideoEntity)

    @Query("DELETE FROM videos WHERE `key` = :videoKey")
    suspend fun deleteVideo(videoKey: String)

    @Query("DELETE FROM videos")
    suspend fun clearAllVideos()

    // --- Channels ---
    @Query("SELECT * FROM channels ORDER BY createdAt ASC")
    fun getAllChannels(): Flow<List<ChannelEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChannels(channels: List<ChannelEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChannel(channel: ChannelEntity)

    @Query("DELETE FROM channels WHERE id = :channelId")
    suspend fun deleteChannel(channelId: String)

    @Query("UPDATE channels SET isSubscribed = :isSubscribed WHERE id = :channelId")
    suspend fun updateChannelSubscription(channelId: String, isSubscribed: Boolean)

    // --- Playlists ---
    @Query("SELECT * FROM playlists ORDER BY createdAt ASC")
    fun getAllPlaylists(): Flow<List<PlaylistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylists(playlists: List<PlaylistEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :playlistId")
    suspend fun deletePlaylist(playlistId: String)

    // --- Watch Progress ---
    @Query("SELECT * FROM watch_progress")
    fun getAllWatchProgress(): Flow<List<WatchProgressEntity>>

    @Query("SELECT * FROM watch_progress WHERE videoKey = :videoKey LIMIT 1")
    suspend fun getWatchProgress(videoKey: String): WatchProgressEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveWatchProgress(progress: WatchProgressEntity)

    @Query("DELETE FROM watch_progress WHERE videoKey = :videoKey")
    suspend fun deleteWatchProgress(videoKey: String)

    // --- Watch History ---
    @Query("SELECT * FROM watch_history ORDER BY watchedAt DESC LIMIT 100")
    fun getWatchHistory(): Flow<List<WatchHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWatchHistory(history: WatchHistoryEntity)

    @Query("DELETE FROM watch_history WHERE videoKey = :videoKey")
    suspend fun deleteWatchHistoryByVideo(videoKey: String)

    @Query("DELETE FROM watch_history")
    suspend fun clearWatchHistory()

    // --- User Interactions (Likes, Dislikes, Watch Later) ---
    @Query("SELECT * FROM user_interactions")
    fun getAllInteractions(): Flow<List<UserInteractionEntity>>

    @Query("SELECT * FROM user_interactions WHERE videoKey = :videoKey LIMIT 1")
    suspend fun getInteraction(videoKey: String): UserInteractionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveInteraction(interaction: UserInteractionEntity)

    // --- Search History ---
    @Query("SELECT * FROM search_history ORDER BY timestamp DESC LIMIT 20")
    fun getSearchHistory(): Flow<List<SearchHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSearchQuery(search: SearchHistoryEntity)

    @Query("DELETE FROM search_history WHERE `query` = :query")
    suspend fun deleteSearchQuery(query: String)

    @Query("DELETE FROM search_history")
    suspend fun clearSearchHistory()

    // --- App Preferences ---
    @Query("SELECT * FROM app_preferences")
    fun getAllPreferences(): Flow<List<AppPreferenceEntity>>

    @Query("SELECT value FROM app_preferences WHERE `key` = :key LIMIT 1")
    suspend fun getPreference(key: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setPreference(pref: AppPreferenceEntity)
}
