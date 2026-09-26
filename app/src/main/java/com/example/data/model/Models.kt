package com.example.data.model

data class VideoItem(
    val key: String,
    val name: String,
    val title: String,
    val uriString: String,
    val size: Long,
    val formattedSize: String,
    val durationMs: Long,
    val formattedDuration: String,
    val ext: String,
    val isShort: Boolean,
    val channelId: String? = null,
    val collabChannelIds: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val thumbnailUri: String? = null,
    val isCustomThumbnail: Boolean = false,
    val dateAdded: Long = System.currentTimeMillis()
)

data class ChannelItem(
    val id: String,
    val name: String,
    val handle: String,
    val colorHex: String,
    val description: String,
    val logoUri: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val isSubscribed: Boolean = false
)

data class PlaylistItem(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis(),
    val videoKeys: List<String> = emptyList()
)

data class WatchProgressItem(
    val videoKey: String,
    val currentTimeMs: Long,
    val durationMs: Long,
    val completed: Boolean,
    val updatedAt: Long
)

data class WatchHistoryItem(
    val id: Long = 0,
    val videoKey: String,
    val watchedAt: Long = System.currentTimeMillis()
)

enum class VideoSort {
    NONE,
    NAME,
    SIZE
}

enum class MainView(val title: String) {
    ALL("All Videos"),
    LIKED("Liked Videos"),
    WATCH_LATER("Watch Later"),
    UNTAGGED("Untagged"),
    HISTORY("Watch History"),
    SHORTS("Shorts"),
    PLAYLIST("Playlist"),
    CHANNEL("Channel"),
    ALL_CHANNELS("All Channels"),
    SUBSCRIBED_CHANNELS("Subscribed Channels"),
    VIDEOS_WITHOUT_CHANNEL("Videos Without a Channel"),
    SETTINGS("Settings & Preferences")
}
