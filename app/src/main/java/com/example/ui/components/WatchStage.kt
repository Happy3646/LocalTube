package com.example.ui.components

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.example.data.model.*
import com.example.player.LocalTubePlayerManager
import com.example.ui.theme.*
import kotlinx.coroutines.delay
import java.util.Locale

@OptIn(UnstableApi::class)
@Composable
fun WatchStage(
    video: VideoItem,
    playerManager: LocalTubePlayerManager,
    channels: List<ChannelItem>,
    isLiked: Boolean,
    isDisliked: Boolean,
    isWatchLater: Boolean,
    resumeToastText: String?,
    upNextQueue: List<VideoItem>,
    autoplayEnabled: Boolean,
    onAutoplayChange: (Boolean) -> Unit,
    onPlayNext: () -> Unit,
    onPlayPrevious: () -> Unit,
    onPlayVideo: (VideoItem) -> Unit,
    onMixUpNext: () -> Unit,
    onToggleLike: () -> Unit,
    onToggleDislike: () -> Unit,
    onToggleWatchLater: () -> Unit,
    onSaveToPlaylistClick: () -> Unit,
    onOpenChannelClick: (String) -> Unit,
    onSubscribeChannelClick: (String) -> Unit,
    onAddTag: (String) -> Unit,
    onRemoveTag: (String) -> Unit,
    onOpenAssignChannel: () -> Unit,
    onOpenTagEditor: () -> Unit,
    onOpenUploadThumbnail: () -> Unit,
    onBackToBrowseClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val playerState by playerManager.playerState.collectAsState()
    var showControls by remember { mutableStateOf(true) }
    var isUserInteracting by remember { mutableStateOf(false) }
    var showSpeedMenu by remember { mutableStateOf(false) }
    var showMoreMenu by remember { mutableStateOf(false) }
    var showInlineTagInput by remember { mutableStateOf(false) }
    var inlineTagText by remember { mutableStateOf("") }
    var isFullscreen by remember { mutableStateOf(false) }

    // Auto-hide controls after 5 seconds of inactivity
    LaunchedEffect(playerState.isPlaying, isUserInteracting, showControls) {
        if (playerState.isPlaying && showControls && !isUserInteracting && !showSpeedMenu && !showMoreMenu) {
            delay(5000)
            showControls = false
        }
    }

    val primaryChannel = remember(video.channelId, channels) {
        channels.find { it.id == video.channelId }
    }

    val collabChannels = remember(video.collabChannelIds, channels) {
        video.collabChannelIds.mapNotNull { id -> channels.find { it.id == id } }
    }

    val allCreators = remember(primaryChannel, collabChannels) {
        val list = mutableListOf<Pair<ChannelItem, Boolean>>()
        if (primaryChannel != null) list.add(primaryChannel to true)
        collabChannels.forEach { c ->
            if (list.none { it.first.id == c.id }) list.add(c to false)
        }
        list
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .testTag("watch_stage_view"),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // --- 1. VIDEO PLAYER STAGE ---
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(if (isFullscreen) 16f / 10f else 16f / 9f)
                    .background(Color.Black)
                    .clickable { showControls = !showControls }
            ) {
                // Media3 Player View
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = playerManager.getPlayer()
                            useController = false
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    update = { view ->
                        view.player = playerManager.getPlayer()
                    },
                    modifier = Modifier.fillMaxSize()
                )

                // Resume Toast Overlay
                AnimatedVisibility(
                    visible = resumeToastText != null,
                    enter = fadeIn(),
                    exit = fadeOut(),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(16.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Color(0xFF0F172A).copy(alpha = 0.9f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF0284C7)),
                        shadowElevation = 6.dp
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Replay,
                                contentDescription = null,
                                tint = YTBlue,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = resumeToastText ?: "",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF38BDF8)
                            )
                        }
                    }
                }

                // Controls Overlay
                AnimatedVisibility(
                    visible = showControls,
                    enter = fadeIn(),
                    exit = fadeOut(),
                    modifier = Modifier.fillMaxSize()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.45f))
                    ) {
                        // Top row inside player: Back & Title
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.TopStart)
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconButton(onClick = onBackToBrowseClick) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Back",
                                    tint = Color.White
                                )
                            }
                            Text(
                                text = video.title,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        // Center Controls: Prev, Seek -10s, Play/Pause, Seek +10s, Next
                        Row(
                            modifier = Modifier.align(Alignment.Center),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            IconButton(onClick = onPlayPrevious, modifier = Modifier.size(44.dp)) {
                                Icon(
                                    imageVector = Icons.Default.SkipPrevious,
                                    contentDescription = "Previous video",
                                    tint = Color.White,
                                    modifier = Modifier.size(28.dp)
                                )
                            }

                            IconButton(
                                onClick = { playerManager.seekBy(-10_000L) },
                                modifier = Modifier.size(44.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Replay10,
                                    contentDescription = "Rewind 10 seconds",
                                    tint = Color.White,
                                    modifier = Modifier.size(30.dp)
                                )
                            }

                            // Big Play/Pause Button
                            Box(
                                modifier = Modifier
                                    .size(62.dp)
                                    .clip(CircleShape)
                                    .background(YTRed)
                                    .clickable { playerManager.togglePlayPause() }
                                    .testTag("play_pause_button"),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = if (playerState.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                    contentDescription = "Play/Pause",
                                    tint = Color.White,
                                    modifier = Modifier.size(36.dp)
                                )
                            }

                            IconButton(
                                onClick = { playerManager.seekBy(10_000L) },
                                modifier = Modifier.size(44.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Forward10,
                                    contentDescription = "Forward 10 seconds",
                                    tint = Color.White,
                                    modifier = Modifier.size(30.dp)
                                )
                            }

                            IconButton(onClick = onPlayNext, modifier = Modifier.size(44.dp)) {
                                Icon(
                                    imageVector = Icons.Default.SkipNext,
                                    contentDescription = "Next video",
                                    tint = Color.White,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        }

                        // Bottom Controls Bar (Scrubber, Speed, Loop, Fullscreen)
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.BottomCenter)
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            // Scrubber
                            val currentPos = playerState.currentPositionMs.toFloat()
                            val totalDur = playerState.durationMs.coerceAtLeast(1L).toFloat()

                            Slider(
                                value = currentPos.coerceIn(0f, totalDur),
                                onValueChange = {
                                    isUserInteracting = true
                                    playerManager.seekTo(it.toLong())
                                },
                                onValueChangeFinished = { isUserInteracting = false },
                                valueRange = 0f..totalDur,
                                colors = SliderDefaults.colors(
                                    thumbColor = YTRed,
                                    activeTrackColor = YTRed,
                                    inactiveTrackColor = Color.White.copy(alpha = 0.3f)
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(20.dp)
                                    .testTag("seek_bar")
                            )

                            // Controls Row
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                // Time label
                                Text(
                                    text = "${formatDuration(playerState.currentPositionMs)} / ${formatDuration(playerState.durationMs)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color.White
                                )

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    // Mute / Volume Button
                                    IconButton(
                                        onClick = { playerManager.toggleMute() },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            imageVector = if (playerState.isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                                            contentDescription = "Volume",
                                            tint = Color.White,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }

                                    // Speed Button
                                    Box {
                                        TextButton(
                                            onClick = { showSpeedMenu = true },
                                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                        ) {
                                            Text(
                                                text = "${playerState.playbackSpeed}x",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color.White
                                            )
                                        }

                                        DropdownMenu(
                                            expanded = showSpeedMenu,
                                            onDismissRequest = { showSpeedMenu = false }
                                        ) {
                                            listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f).forEach { spd ->
                                                DropdownMenuItem(
                                                    text = { Text("${spd}x" + if (spd == 1.0f) " (Normal)" else "") },
                                                    onClick = {
                                                        playerManager.setSpeed(spd)
                                                        showSpeedMenu = false
                                                    }
                                                )
                                            }
                                        }
                                    }

                                    // Loop Button
                                    IconButton(
                                        onClick = { playerManager.toggleLoop() },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Repeat,
                                            contentDescription = "Loop",
                                            tint = if (playerState.isLooping) YTBlue else Color.White,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }

                                    // Fullscreen Button
                                    IconButton(
                                        onClick = { isFullscreen = !isFullscreen },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            imageVector = if (isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                                            contentDescription = "Fullscreen",
                                            tint = Color.White,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- 2. VIDEO METADATA & ACTIONS ---
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                // Video Title
                Text(
                    text = video.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Watch Tags Row with Remove '✕' and Inline '+ Add Tag'
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    video.tags.forEach { tag ->
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color(0xFF201833),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF433367))
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.padding(start = 10.dp, end = 6.dp, top = 3.dp, bottom = 3.dp)
                            ) {
                                Text(
                                    text = "#$tag",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFFC4B5FD)
                                )
                                IconButton(
                                    onClick = { onRemoveTag(tag) },
                                    modifier = Modifier.size(16.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Remove tag",
                                        tint = Color(0xFFA78BFA),
                                        modifier = Modifier.size(12.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Inline + Add Tag Input
                    if (showInlineTagInput) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            border = androidx.compose.foundation.BorderStroke(1.dp, YTPurple)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                androidx.compose.foundation.text.BasicTextField(
                                    value = inlineTagText,
                                    onValueChange = { inlineTagText = it },
                                    singleLine = true,
                                    textStyle = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onBackground),
                                    modifier = Modifier.width(90.dp)
                                )
                                IconButton(
                                    onClick = {
                                        if (inlineTagText.isNotBlank()) {
                                            onAddTag(inlineTagText)
                                            inlineTagText = ""
                                            showInlineTagInput = false
                                        }
                                    },
                                    modifier = Modifier.size(20.dp)
                                ) {
                                    Icon(Icons.Default.Check, contentDescription = "Save", tint = YTGreen, modifier = Modifier.size(14.dp))
                                }
                                IconButton(
                                    onClick = {
                                        inlineTagText = ""
                                        showInlineTagInput = false
                                    },
                                    modifier = Modifier.size(20.dp)
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = "Cancel", tint = Color.Gray, modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    } else {
                        OutlinedButton(
                            onClick = { showInlineTagInput = true },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text("Tag", fontSize = 11.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Multi-Creator Attribution Bar (YouTube Style)
                if (allCreators.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        allCreators.forEach { (creator, isPrimary) ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { onOpenChannelClick(creator.id) }
                                ) {
                                    val chColor = remember(creator.colorHex) {
                                        try { Color(android.graphics.Color.parseColor(creator.colorHex)) } catch (e: Exception) { YTRed }
                                    }
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(CircleShape)
                                            .background(chColor),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = creator.name.take(1).uppercase(Locale.ROOT),
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                    }

                                    Column {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Text(
                                                text = creator.name,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp,
                                                color = MaterialTheme.colorScheme.onBackground
                                            )
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(if (isPrimary) YTBlue.copy(alpha = 0.2f) else YTAmber.copy(alpha = 0.2f))
                                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                                            ) {
                                                Text(
                                                    text = if (isPrimary) "Creator" else "Collab",
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isPrimary) YTBlue else YTAmber
                                                )
                                            }
                                        }
                                        Text(
                                            text = "${creator.handle} • ${if (creator.isSubscribed) "Subscribed" else "Offline Channel"}",
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }

                                // Subscribe Button
                                Button(
                                    onClick = { onSubscribeChannelClick(creator.id) },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (creator.isSubscribed) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.onBackground,
                                        contentColor = if (creator.isSubscribed) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.background
                                    ),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                    modifier = Modifier.height(32.dp)
                                ) {
                                    Icon(
                                        imageVector = if (creator.isSubscribed) Icons.Default.NotificationsActive else Icons.Default.NotificationsNone,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = if (creator.isSubscribed) "Subscribed" else "Subscribe",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // No Channel Attached Card
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF383838)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = Color.LightGray)
                            }
                            Column {
                                Text("No Channel", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text("Offline Video • Unassigned", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }

                        Button(
                            onClick = onOpenAssignChannel,
                            colors = ButtonDefaults.buttonColors(containerColor = YTBlue, contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text("+ Channel", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // YouTube Style Action Pills Bar (Like/Dislike, Watch Later, Save, 3-dots, Back)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Segmented Like / Dislike
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Row(
                                modifier = Modifier
                                    .clickable { onToggleLike() }
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = if (isLiked) Icons.Default.ThumbUp else Icons.Default.ThumbUpOffAlt,
                                    contentDescription = "Like",
                                    tint = if (isLiked) YTRed else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = if (isLiked) "Liked" else "Like",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .width(1.dp)
                                    .height(18.dp)
                                    .background(MaterialTheme.colorScheme.outline)
                            )
                            Box(
                                modifier = Modifier
                                    .clickable { onToggleDislike() }
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = if (isDisliked) Icons.Default.ThumbDown else Icons.Default.ThumbDownOffAlt,
                                    contentDescription = "Dislike",
                                    tint = if (isDisliked) YTRed else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }

                    // Watch Later
                    FilledTonalButton(
                        onClick = onToggleWatchLater,
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = if (isWatchLater) YTBlue.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surfaceVariant,
                            contentColor = if (isWatchLater) YTBlue else MaterialTheme.colorScheme.onSurface
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Icon(
                            imageVector = if (isWatchLater) Icons.Default.WatchLater else Icons.Default.AccessTime,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(if (isWatchLater) "Saved" else "Watch Later", fontSize = 12.sp)
                    }

                    // Save to Playlist
                    FilledTonalButton(
                        onClick = onSaveToPlaylistClick,
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            contentColor = MaterialTheme.colorScheme.onSurface
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Icon(Icons.Default.PlaylistAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Save", fontSize = 12.sp)
                    }

                    // More Menu
                    Box {
                        IconButton(
                            onClick = { showMoreMenu = true },
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        ) {
                            Icon(Icons.Default.MoreVert, contentDescription = "More", modifier = Modifier.size(18.dp))
                        }

                        DropdownMenu(
                            expanded = showMoreMenu,
                            onDismissRequest = { showMoreMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Upload Custom Image") },
                                leadingIcon = { Icon(Icons.Default.Image, contentDescription = null, tint = YTPurple) },
                                onClick = {
                                    showMoreMenu = false
                                    onOpenUploadThumbnail()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Add / Manage Channel") },
                                leadingIcon = { Icon(Icons.Default.Subscriptions, contentDescription = null, tint = YTRed) },
                                onClick = {
                                    showMoreMenu = false
                                    onOpenAssignChannel()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Manage Tags") },
                                leadingIcon = { Icon(Icons.Default.Tag, contentDescription = null, tint = YTGreen) },
                                onClick = {
                                    showMoreMenu = false
                                    onOpenTagEditor()
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Details Box (File ext, size, filename)
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(YTBlue.copy(alpha = 0.2f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(video.ext, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = YTBlue)
                            }
                            Text(video.formattedSize, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("•", color = MaterialTheme.colorScheme.outline)
                            Text(video.name, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Local offline playback with persistent folder memory, timestamp resume, and custom tags. Use onscreen controls or keyboard shortcuts to seek, adjust speed, and loop.",
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                        )
                    }
                }
            }
        }

        // --- 3. "UP NEXT" QUEUE HEADER ---
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "Up Next",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = "${upNextQueue.size} videos",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Autoplay switch
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("Autoplay", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Switch(
                            checked = autoplayEnabled,
                            onCheckedChange = onAutoplayChange,
                            modifier = Modifier.scale(0.8f)
                        )
                    }

                    // Mix queue button
                    FilledTonalButton(
                        onClick = onMixUpNext,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                        modifier = Modifier.height(28.dp)
                    ) {
                        Icon(Icons.Default.Shuffle, contentDescription = null, modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(3.dp))
                        Text("Mix", fontSize = 11.sp)
                    }
                }
            }
        }

        // --- 4. UP NEXT LIST ITEMS ---
        items(upNextQueue) { queueItem ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onPlayVideo(queueItem) }
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Mini 16:9 thumbnail
                Box(
                    modifier = Modifier
                        .width(120.dp)
                        .aspectRatio(16f / 9f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    val thumbModel = queueItem.thumbnailUri ?: queueItem.uriString
                    AsyncImage(
                        model = thumbModel,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(4.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(Color.Black.copy(alpha = 0.8f))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    ) {
                        Text(queueItem.formattedDuration, fontSize = 9.sp, color = Color.White)
                    }
                }

                // Info
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        text = queueItem.title,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    val ch = channels.find { it.id == queueItem.channelId }
                    Text(
                        text = ch?.name ?: "Local Video",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "${queueItem.formattedSize} • ${queueItem.ext}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
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

// Scale extension for Switch in Compose
fun Modifier.scale(scale: Float): Modifier = this.then(
    Modifier.size((52 * scale).dp, (32 * scale).dp)
)
