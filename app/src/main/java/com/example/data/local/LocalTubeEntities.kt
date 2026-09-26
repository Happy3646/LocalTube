package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "videos")
data class VideoEntity(
    @PrimaryKey val key: String,
    val name: String,
    val title: String,
    val uriString: String,
    val size: Long,
    val formattedSize: String,
    val durationMs: Long,
    val formattedDuration: String,
    val ext: String,
    val isShort: Boolean,
    val channelId: String?,
    val collabChannelIds: String, // comma-separated or JSON list
    val tags: String, // comma-separated list of tags
    val thumbnailUri: String?,
    val isCustomThumbnail: Boolean,
    val dateAdded: Long
)

@Entity(tableName = "channels")
data class ChannelEntity(
    @PrimaryKey val id: String,
    val name: String,
    val handle: String,
    val colorHex: String,
    val description: String,
    val logoUri: String?,
    val createdAt: Long,
    val isSubscribed: Boolean
)

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val createdAt: Long,
    val videoKeysJson: String // comma-separated or JSON
)

@Entity(tableName = "watch_progress")
data class WatchProgressEntity(
    @PrimaryKey val videoKey: String,
    val currentTimeMs: Long,
    val durationMs: Long,
    val completed: Boolean,
    val updatedAt: Long
)

@Entity(tableName = "watch_history")
data class WatchHistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val videoKey: String,
    val watchedAt: Long
)

@Entity(tableName = "user_interactions")
data class UserInteractionEntity(
    @PrimaryKey val videoKey: String,
    val isLiked: Boolean = false,
    val isDisliked: Boolean = false,
    val isWatchLater: Boolean = false
)

@Entity(tableName = "search_history")
data class SearchHistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val query: String,
    val timestamp: Long
)

@Entity(tableName = "app_preferences")
data class AppPreferenceEntity(
    @PrimaryKey val key: String,
    val value: String
)
