package com.example.ui.components

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.example.data.model.ChannelItem
import com.example.data.model.VideoItem
import com.example.ui.theme.YTRed
import kotlinx.coroutines.delay
import java.util.Locale

@OptIn(UnstableApi::class)
@Composable
fun ShortsFeed(
    shortsVideos: List<VideoItem>,
    channels: List<ChannelItem>,
    isLiked: (String) -> Boolean,
    isDisliked: (String) -> Boolean,
    onToggleLike: (String) -> Unit,
    onToggleDislike: (String) -> Unit,
    onPlaylistClick: (VideoItem) -> Unit,
    onTagsClick: (VideoItem) -> Unit,
    onChannelClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    if (shortsVideos.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayCircle,
                        contentDescription = null,
                        tint = YTRed,
                        modifier = Modifier.size(40.dp)
                    )
                }
                Text(
                    text = "No Shorts Found",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Upload vertical videos or videos under 60 seconds (or add the #shorts tag) to watch them in this YouTube Shorts scroll feed!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }
        return
    }

    val pagerState = rememberPagerState(pageCount = { shortsVideos.size })

    VerticalPager(
        state = pagerState,
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .testTag("shorts_scroll_viewport")
    ) { page ->
        val video = shortsVideos[page]
        val isCurrentPage = pagerState.currentPage == page
        val channel = channels.find { it.id == video.channelId }

        ShortVideoItem(
            video = video,
            channel = channel,
            isCurrentPage = isCurrentPage,
            isLiked = isLiked(video.key),
            isDisliked = isDisliked(video.key),
            onToggleLike = { onToggleLike(video.key) },
            onToggleDislike = { onToggleDislike(video.key) },
            onPlaylistClick = { onPlaylistClick(video) },
            onTagsClick = { onTagsClick(video) },
            onChannelClick = { channel?.let { onChannelClick(it.id) } }
        )
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun ShortVideoItem(
    video: VideoItem,
    channel: ChannelItem?,
    isCurrentPage: Boolean,
    isLiked: Boolean,
    isDisliked: Boolean,
    onToggleLike: () -> Unit,
    onToggleDislike: () -> Unit,
    onPlaylistClick: () -> Unit,
    onTagsClick: () -> Unit,
    onChannelClick: () -> Unit
) {
    val context = LocalContext.current
    var isMuted by remember { mutableStateOf(false) }
    var isPaused by remember { mutableStateOf(false) }
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }
    var progressFraction by remember { mutableFloatStateOf(0f) }

    DisposableEffect(video.uriString, isCurrentPage) {
        if (isCurrentPage) {
            val player = ExoPlayer.Builder(context).build().apply {
                repeatMode = Player.REPEAT_MODE_ONE
                val mediaItem = MediaItem.fromUri(video.uriString)
                setMediaItem(mediaItem)
                prepare()
                play()
            }
            exoPlayer = player

            onDispose {
                player.release()
                exoPlayer = null
            }
        } else {
            exoPlayer?.release()
            exoPlayer = null
            onDispose { }
        }
    }

    // Keep progress updated
    LaunchedEffect(isCurrentPage, exoPlayer) {
        while (isCurrentPage && exoPlayer != null) {
            exoPlayer?.let { p ->
                val pos = p.currentPosition.toFloat()
                val dur = p.duration.coerceAtLeast(1L).toFloat()
                progressFraction = (pos / dur).coerceIn(0f, 1f)
            }
            delay(100)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable {
                exoPlayer?.let { p ->
                    if (p.isPlaying) {
                        p.pause()
                        isPaused = true
                    } else {
                        p.play()
                        isPaused = false
                    }
                }
            }
    ) {
        // Video View
        if (exoPlayer != null) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        player = exoPlayer
                        useController = false
                        layoutParams = FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Pause Indicator Overlay
        if (isPaused) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.6f))
                    .align(Alignment.Center),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Pause,
                    contentDescription = "Paused",
                    tint = Color.White,
                    modifier = Modifier.size(36.dp)
                )
            }
        }

        // Bottom Gradient Overlay for Metadata
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                    )
                )
        )

        // Metadata: Channel, Title, Tags (Bottom Left)
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, end = 72.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Channel row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.clickable { onChannelClick() }
            ) {
                val chColor = remember(channel?.colorHex) {
                    try { Color(android.graphics.Color.parseColor(channel?.colorHex ?: "#FF0000")) } catch (e: Exception) { YTRed }
                }
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(chColor),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (channel?.name ?: "S").take(1).uppercase(Locale.ROOT),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                Text(
                    text = channel?.name ?: "Local Shorts",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = Color.White
                )
            }

            // Title
            Text(
                text = video.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            // Tags
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                video.tags.take(3).forEach { tag ->
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.5f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text("#$tag", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF3EA6FF))
                    }
                }
            }
        }

        // Side Action Bar (Right side, YouTube Shorts style)
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 12.dp, bottom = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Like
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(
                    onClick = onToggleLike,
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF212121).copy(alpha = 0.85f))
                ) {
                    Icon(
                        imageVector = if (isLiked) Icons.Default.ThumbUp else Icons.Default.ThumbUpOffAlt,
                        contentDescription = "Like",
                        tint = if (isLiked) YTRed else Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Text(text = if (isLiked) "Liked" else "Like", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Medium)
            }

            // Dislike
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(
                    onClick = onToggleDislike,
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF212121).copy(alpha = 0.85f))
                ) {
                    Icon(
                        imageVector = if (isDisliked) Icons.Default.ThumbDown else Icons.Default.ThumbDownOffAlt,
                        contentDescription = "Dislike",
                        tint = if (isDisliked) YTRed else Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Text(text = "Dislike", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Medium)
            }

            // Playlist
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(
                    onClick = onPlaylistClick,
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF212121).copy(alpha = 0.85f))
                ) {
                    Icon(
                        imageVector = Icons.Default.PlaylistAdd,
                        contentDescription = "Playlist",
                        tint = Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Text(text = "Save", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Medium)
            }

            // Tags
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(
                    onClick = onTagsClick,
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF212121).copy(alpha = 0.85f))
                ) {
                    Icon(
                        imageVector = Icons.Default.Tag,
                        contentDescription = "Tags",
                        tint = Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Text(text = "Tags", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Medium)
            }

            // Sound Mute Toggle
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                IconButton(
                    onClick = {
                        isMuted = !isMuted
                        exoPlayer?.volume = if (isMuted) 0f else 1f
                    },
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF212121).copy(alpha = 0.85f))
                ) {
                    Icon(
                        imageVector = if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                        contentDescription = "Sound",
                        tint = Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Text(text = if (isMuted) "Muted" else "Sound", fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Medium)
            }
        }

        // Bottom Edge Progress Line
        LinearProgressIndicator(
            progress = { progressFraction },
            modifier = Modifier
                .fillMaxWidth()
                .height(3.dp)
                .align(Alignment.BottomCenter),
            color = YTRed,
            trackColor = Color.White.copy(alpha = 0.2f),
        )
    }
}
