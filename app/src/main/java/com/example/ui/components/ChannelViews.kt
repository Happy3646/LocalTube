package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.model.ChannelItem
import com.example.data.model.VideoItem
import com.example.ui.theme.YTBlue
import com.example.ui.theme.YTRed
import java.util.Locale

@Composable
fun ChannelHeroView(
    channel: ChannelItem,
    channelVideos: List<VideoItem>,
    isSubscribed: Boolean,
    onSubscribeToggle: () -> Unit,
    onAddVideosClick: () -> Unit,
    onEditChannelClick: () -> Unit,
    onDeleteChannelClick: () -> Unit,
    onPickLogoClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var isDescExpanded by remember { mutableStateOf(false) }
    val desc = channel.description.ifBlank { "Welcome to ${channel.name}!" }

    val chColor = remember(channel.colorHex) {
        try { Color(android.graphics.Color.parseColor(channel.colorHex)) } catch (e: Exception) { YTRed }
    }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier
            .fillMaxWidth()
            .testTag("channel_hero_banner")
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Hero Cover
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(chColor.copy(alpha = 0.5f), Color(0xFF121212))
                        )
                    )
            )

            // Avatar & Info
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .offset(y = (-36).dp)
            ) {
                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Avatar with Camera Badge
                    Box(
                        modifier = Modifier
                            .size(76.dp)
                            .clip(CircleShape)
                            .background(chColor)
                            .border(3.dp, MaterialTheme.colorScheme.surface, CircleShape)
                            .clickable { onPickLogoClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        if (channel.logoUri != null) {
                            AsyncImage(
                                model = channel.logoUri,
                                contentDescription = channel.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            Text(
                                text = channel.name.take(1).uppercase(Locale.ROOT),
                                fontSize = 32.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }

                        // Camera icon overlay
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .align(Alignment.BottomEnd)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surface)
                                .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = "Change Logo",
                                tint = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }

                    // Channel Name & Subscribe Button
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = channel.name,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "${channel.handle} • ${channelVideos.size} ${if (channelVideos.size == 1) "video" else "videos"}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Subscribe Button
                    Button(
                        onClick = onSubscribeToggle,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSubscribed) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.onBackground,
                            contentColor = if (isSubscribed) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.background
                        ),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
                        modifier = Modifier.height(36.dp)
                    ) {
                        Icon(
                            imageVector = if (isSubscribed) Icons.Default.NotificationsActive else Icons.Default.NotificationsNone,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isSubscribed) "Subscribed" else "Subscribe",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Description
                val desc = channel.description.ifBlank { "Welcome to ${channel.name}!" }
                Text(
                    text = desc,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = if (isDescExpanded) Int.MAX_VALUE else 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (desc.length > 80) {
                    Text(
                        text = if (isDescExpanded) "Show less" else "...more",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = YTBlue,
                        modifier = Modifier
                            .clickable { isDescExpanded = !isDescExpanded }
                            .padding(top = 2.dp)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Action Buttons: Add Videos, Edit Channel, Delete Channel
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = onAddVideosClick,
                        colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Videos", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    FilledTonalButton(
                        onClick = onEditChannelClick,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Edit", fontSize = 11.sp)
                    }

                    OutlinedButton(
                        onClick = onDeleteChannelClick,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFFF6B6B)),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Delete", fontSize = 11.sp)
                    }
                }
            }

            // Tabs: Videos / About
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Color.Transparent,
                contentColor = MaterialTheme.colorScheme.onSurface,
                divider = { HorizontalDivider(color = MaterialTheme.colorScheme.outline) }
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Videos (${channelVideos.size})", fontWeight = FontWeight.SemiBold) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("About", fontWeight = FontWeight.SemiBold) }
                )
            }

            // About Tab Content
            if (selectedTab == 1) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Description", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(desc, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                    Text("Channel Stats", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text("Total Videos: ${channelVideos.size}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Status: Active Local Channel", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun ChannelsDirectoryView(
    channels: List<ChannelItem>,
    allVideos: List<VideoItem>,
    onOpenChannel: (String) -> Unit,
    onToggleSubscribe: (String) -> Unit,
    onCreateChannelClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
            .testTag("all_channels_directory")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text("Your Channels", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Organize offline videos into creator channels & subscriptions", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Button(
                onClick = onCreateChannelClick,
                colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White),
                modifier = Modifier.testTag("create_channel_button")
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("New Channel", fontWeight = FontWeight.Bold)
            }
        }

        if (channels.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No channels created yet. Click 'New Channel' to start!", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(260.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(channels) { channel ->
                    val videoCount = allVideos.count { it.channelId == channel.id || it.collabChannelIds.contains(channel.id) }
                    val chColor = remember(channel.colorHex) {
                        try { Color(android.graphics.Color.parseColor(channel.colorHex)) } catch (e: Exception) { YTRed }
                    }

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenChannel(channel.id) },
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(60.dp)
                                    .clip(CircleShape)
                                    .background(chColor),
                                contentAlignment = Alignment.Center
                            ) {
                                if (channel.logoUri != null) {
                                    AsyncImage(
                                        model = channel.logoUri,
                                        contentDescription = channel.name,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    Text(
                                        text = channel.name.take(1).uppercase(Locale.ROOT),
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                }
                            }

                            Text(
                                text = channel.name,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "${channel.handle} • $videoCount ${if (videoCount == 1) "video" else "videos"}",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            Text(
                                text = channel.description.ifBlank { "Offline creator channel." },
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    onClick = { onOpenChannel(channel.id) },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("View", fontSize = 12.sp)
                                }

                                Button(
                                    onClick = { onToggleSubscribe(channel.id) },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (channel.isSubscribed) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.onBackground,
                                        contentColor = if (channel.isSubscribed) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.background
                                    ),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(if (channel.isSubscribed) "Subscribed" else "Subscribe", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
