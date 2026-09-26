package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import coil.decode.VideoFrameDecoder
import com.example.data.model.ChannelItem
import com.example.data.model.VideoItem
import com.example.data.model.WatchProgressItem
import com.example.ui.theme.*
import java.util.Locale

@Composable
fun VideoCard(
    video: VideoItem,
    channel: ChannelItem?,
    collabs: List<ChannelItem>,
    progress: WatchProgressItem?,
    isLiked: Boolean,
    isWatchLater: Boolean,
    isSelectionActive: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onChannelClick: (String) -> Unit,
    onTagClick: (String) -> Unit,
    onEditTagsClick: () -> Unit,
    onAssignChannelClick: () -> Unit,
    onToggleLike: () -> Unit,
    onToggleWatchLater: () -> Unit,
    onAddToPlaylistClick: () -> Unit,
    onUploadThumbnailClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showMenu by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val allChannels = remember(channel, collabs) {
        val list = mutableListOf<ChannelItem>()
        if (channel != null) list.add(channel)
        for (c in collabs) {
            if (!list.any { it.id == c.id }) list.add(c)
        }
        list
    }

    val progressPercent = remember(progress) {
        if (progress != null && progress.durationMs > 0 && progress.currentTimeMs > 2000L) {
            (progress.currentTimeMs.toFloat() / progress.durationMs.toFloat()).coerceIn(0f, 1f)
        } else 0f
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .testTag("video_card_${video.key}"),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.surfaceVariant else Color.Transparent
        ),
        border = if (isSelected) androidx.compose.foundation.BorderStroke(2.dp, YTRed) else null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp)
        ) {
            // Thumbnail Box (16:9)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                // Video Frame / Thumbnail Image using Coil with VideoFrameDecoder
                val imageModel = video.thumbnailUri ?: video.uriString
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(imageModel)
                        .decoderFactory { result, options, _ ->
                            VideoFrameDecoder(result.source, options)
                        }
                        .crossfade(true)
                        .build(),
                    contentDescription = video.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Multi-select Checkbox (top-left)
                if (isSelectionActive || isSelected) {
                    Box(
                        modifier = Modifier
                            .padding(8.dp)
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) YTRed else Color.Black.copy(alpha = 0.6f))
                            .border(2.dp, Color.White, CircleShape)
                            .clickable { onLongClick() }
                            .align(Alignment.TopStart),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Selected",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                // Quick Like Button (top-right next to menu)
                IconButton(
                    onClick = onToggleLike,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(end = 40.dp, top = 6.dp)
                        .size(30.dp)
                        .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                ) {
                    Icon(
                        imageVector = if (isLiked) Icons.Default.ThumbUp else Icons.Default.ThumbUpOffAlt,
                        contentDescription = "Like",
                        tint = if (isLiked) YTRed else Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }

                // 3-Dots More Options Menu Button
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(end = 6.dp, top = 6.dp)
                ) {
                    IconButton(
                        onClick = { showMenu = true },
                        modifier = Modifier
                            .size(30.dp)
                            .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "More options",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false },
                        modifier = Modifier.background(MaterialTheme.colorScheme.surface)
                    ) {
                        DropdownMenuItem(
                            text = { Text("Upload Custom Thumbnail") },
                            leadingIcon = { Icon(Icons.Default.Image, contentDescription = null, tint = YTPurple) },
                            onClick = {
                                showMenu = false
                                onUploadThumbnailClick()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text(if (isWatchLater) "Remove from Watch Later" else "Save to Watch Later") },
                            leadingIcon = { Icon(Icons.Default.WatchLater, contentDescription = null, tint = YTBlue) },
                            onClick = {
                                showMenu = false
                                onToggleWatchLater()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Save to Playlist") },
                            leadingIcon = { Icon(Icons.Default.PlaylistAdd, contentDescription = null, tint = YTAmber) },
                            onClick = {
                                showMenu = false
                                onAddToPlaylistClick()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text(if (allChannels.isNotEmpty()) "Channel & Collabs" else "Add to Channel") },
                            leadingIcon = { Icon(Icons.Default.Subscriptions, contentDescription = null, tint = YTRed) },
                            onClick = {
                                showMenu = false
                                onAssignChannelClick()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Edit Tags") },
                            leadingIcon = { Icon(Icons.Default.Tag, contentDescription = null, tint = YTGreen) },
                            onClick = {
                                showMenu = false
                                onEditTagsClick()
                            }
                        )
                    }
                }

                // Duration badge (bottom-right)
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 6.dp, bottom = 6.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.Black.copy(alpha = 0.85f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = video.formattedDuration,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }

                // Progress Bar at the bottom
                if (progressPercent > 0f) {
                    LinearProgressIndicator(
                        progress = { progressPercent },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .align(Alignment.BottomCenter),
                        color = YTRed,
                        trackColor = Color.White.copy(alpha = 0.3f),
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Card Metadata Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Channel Avatar or Collab Stack
                if (allChannels.size > 1) {
                    // Multi-Creator Collab Overlapping Stack
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clickable { onChannelClick(allChannels[0].id) }
                    ) {
                        val prim = allChannels[0]
                        val collab1 = allChannels[1]

                        // Primary Avatar (Top-Left)
                        val primColor = remember(prim.colorHex) {
                            try { Color(android.graphics.Color.parseColor(prim.colorHex)) } catch (e: Exception) { YTRed }
                        }
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .align(Alignment.TopStart)
                                .clip(CircleShape)
                                .background(primColor)
                                .border(1.5.dp, MaterialTheme.colorScheme.background, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = prim.name.take(1).uppercase(Locale.ROOT),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }

                        // Collab Avatar (Bottom-Right)
                        val collabColor = remember(collab1.colorHex) {
                            try { Color(android.graphics.Color.parseColor(collab1.colorHex)) } catch (e: Exception) { YTAmber }
                        }
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .align(Alignment.BottomEnd)
                                .clip(CircleShape)
                                .background(collabColor)
                                .border(1.5.dp, MaterialTheme.colorScheme.background, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = collab1.name.take(1).uppercase(Locale.ROOT),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                } else if (allChannels.size == 1) {
                    val ch = allChannels[0]
                    val chColor = remember(ch.colorHex) {
                        try { Color(android.graphics.Color.parseColor(ch.colorHex)) } catch (e: Exception) { YTRed }
                    }
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(chColor)
                            .clickable { onChannelClick(ch.id) },
                        contentAlignment = Alignment.Center
                    ) {
                        if (ch.logoUri != null) {
                            AsyncImage(
                                model = ch.logoUri,
                                contentDescription = ch.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            Text(
                                text = ch.name.take(1).uppercase(Locale.ROOT),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                } else {
                    // Default No Channel Avatar
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .clickable { onAssignChannelClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "No Channel",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Details Text
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = video.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onBackground,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 19.sp
                    )

                    Spacer(modifier = Modifier.height(3.dp))

                    // Channel name row with collab
                    if (allChannels.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = allChannels[0].name,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.clickable { onChannelClick(allChannels[0].id) }
                            )
                            if (allChannels.size > 1) {
                                Text(
                                    text = "× ${allChannels[1].name}",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = YTAmber,
                                    modifier = Modifier.clickable { onChannelClick(allChannels[1].id) }
                                )
                            }
                            if (allChannels[0].isSubscribed) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(YTPurple.copy(alpha = 0.15f))
                                        .padding(horizontal = 4.dp, vertical = 1.dp)
                                ) {
                                    Text(
                                        text = "★ Subscribed",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = YTPurple
                                    )
                                }
                            }
                        }
                    } else {
                        Text(
                            text = "No Channel (Click to assign)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            modifier = Modifier.clickable { onAssignChannelClick() }
                        )
                    }

                    // Metadata info (size, format)
                    Text(
                        text = "${video.formattedSize} • ${video.ext}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )

                    // Tags & Channel button row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        video.tags.take(3).forEach { tag ->
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = YTPurple.copy(alpha = 0.14f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, YTPurple.copy(alpha = 0.3f)),
                                modifier = Modifier.clickable { onTagClick(tag) }
                            ) {
                                Text(
                                    text = "#$tag",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = YTPurple,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        // + Tag quick button
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp))
                                .clickable { onEditTagsClick() }
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "+ Tag",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        // Channel pill
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .clickable { onAssignChannelClick() }
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (allChannels.isNotEmpty()) {
                                    if (allChannels.size > 1) "🤝 Collab (${allChannels.size})" else allChannels[0].name
                                } else "+ Channel",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}
