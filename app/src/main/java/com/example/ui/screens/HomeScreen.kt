package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.MainView
import com.example.data.model.VideoItem
import com.example.ui.LocalTubeUiState
import com.example.ui.components.FilterChipsBar
import com.example.ui.components.VideoCard
import com.example.ui.theme.YTBlue
import com.example.ui.theme.YTPurple
import com.example.ui.theme.YTRed

@Composable
fun HomeScreen(
    uiState: LocalTubeUiState,
    onVideoClick: (VideoItem) -> Unit,
    onChannelClick: (String) -> Unit,
    onTagClick: (String) -> Unit,
    onEditTagsClick: (VideoItem) -> Unit,
    onAssignChannelClick: (VideoItem) -> Unit,
    onToggleLike: (VideoItem) -> Unit,
    onToggleWatchLater: (VideoItem) -> Unit,
    onAddToPlaylistClick: (VideoItem) -> Unit,
    onUploadThumbnailClick: (VideoItem) -> Unit,
    onToggleSelection: (String) -> Unit,
    onSelectAllVisible: () -> Unit,
    onClearSelection: () -> Unit,
    onBatchTagClick: () -> Unit,
    onBatchChannelClick: () -> Unit,
    onSelectTagFilter: (String?) -> Unit,
    onDeleteTagGlobally: (String) -> Unit,
    onSetSort: (com.example.data.model.VideoSort) -> Unit,
    onScanFolderClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isBatchEligible = uiState.currentView == MainView.UNTAGGED || uiState.currentView == MainView.VIDEOS_WITHOUT_CHANNEL
    val isSelectionActive = isBatchEligible && uiState.selectedVideoKeys.isNotEmpty()

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            // Horizontal Tag Filter & Sorting Chips Bar
            FilterChipsBar(
                allVideos = uiState.allVideos,
                selectedTag = uiState.selectedTagFilter,
                currentSort = uiState.currentSort,
                onSelectTag = onSelectTagFilter,
                onDeleteTag = onDeleteTagGlobally,
                onSetSort = onSetSort,
                videoCount = uiState.filteredVideos.size,
                modifier = Modifier.padding(bottom = 6.dp)
            )

            // Header Title row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = uiState.currentView.title,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )

                    if (uiState.isShuffled) {
                        Surface(
                            shape = CircleShape,
                            color = YTBlue.copy(alpha = 0.15f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, YTBlue.copy(alpha = 0.3f))
                        ) {
                            Text(
                                text = "Shuffled",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = YTBlue,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                    }

                    if (uiState.selectedTagFilter != null) {
                        Surface(
                            shape = CircleShape,
                            color = YTPurple.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, YTPurple.copy(alpha = 0.4f))
                        ) {
                            Text(
                                text = "#${uiState.selectedTagFilter}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = YTPurple,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }

            // Empty state if no videos
            if (uiState.filteredVideos.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.FolderOpen,
                                contentDescription = null,
                                tint = YTBlue,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                        Text(
                            text = "No Videos Found",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Select a folder or import video files from your device to start watching with zero buffering!",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Button(
                            onClick = onScanFolderClick,
                            colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White),
                            modifier = Modifier.padding(top = 8.dp).testTag("empty_select_button")
                        ) {
                            Icon(Icons.Default.Folder, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Select Video Folder", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                // Multi-Column Responsive Video Grid
                LazyVerticalGrid(
                    columns = GridCells.Fixed(uiState.gridColumns),
                    contentPadding = PaddingValues(top = 8.dp, bottom = 90.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize().testTag("video_grid")
                ) {
                    items(uiState.filteredVideos, key = { it.key }) { video ->
                        val primaryCh = uiState.channels.find { it.id == video.channelId }
                        val collabs = uiState.channels.filter { video.collabChannelIds.contains(it.id) }
                        val progress = uiState.watchProgress[video.key]
                        val interaction = uiState.userInteractions[video.key]
                        val isSelected = uiState.selectedVideoKeys.contains(video.key)

                        VideoCard(
                            video = video,
                            channel = primaryCh,
                            collabs = collabs,
                            progress = progress,
                            isLiked = interaction?.isLiked == true,
                            isWatchLater = interaction?.isWatchLater == true,
                            isSelectionActive = isSelectionActive,
                            isSelected = isSelected,
                            onClick = {
                                if (isSelectionActive) {
                                    onToggleSelection(video.key)
                                } else {
                                    onVideoClick(video)
                                }
                            },
                            onLongClick = {
                                if (isBatchEligible) {
                                    onToggleSelection(video.key)
                                }
                            },
                            onChannelClick = onChannelClick,
                            onTagClick = onTagClick,
                            onEditTagsClick = { onEditTagsClick(video) },
                            onAssignChannelClick = { onAssignChannelClick(video) },
                            onToggleLike = { onToggleLike(video) },
                            onToggleWatchLater = { onToggleWatchLater(video) },
                            onAddToPlaylistClick = { onAddToPlaylistClick(video) },
                            onUploadThumbnailClick = { onUploadThumbnailClick(video) }
                        )
                    }
                }
            }
        }

        // Multi-Select Floating Action Bar (Untagged & Without Channel tabs)
        AnimatedVisibility(
            visible = isSelectionActive,
            enter = slideInVertically(initialOffsetY = { it }),
            exit = slideOutVertically(targetOffsetY = { it }),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 76.dp)
                .testTag("multi_select_bar")
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 10.dp,
                shadowElevation = 12.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .height(58.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(YTRed),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                        Text(
                            text = "${uiState.selectedVideoKeys.size} selected",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FilledTonalButton(
                            onClick = onSelectAllVisible,
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text("Select All", fontSize = 11.sp)
                        }

                        Button(
                            onClick = onBatchTagClick,
                            colors = ButtonDefaults.buttonColors(containerColor = YTPurple, contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Icon(Icons.Default.Tag, contentDescription = null, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text("Tag", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = onBatchChannelClick,
                            colors = ButtonDefaults.buttonColors(containerColor = YTBlue, contentColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Icon(Icons.Default.Subscriptions, contentDescription = null, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(3.dp))
                            Text("Channel", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        IconButton(
                            onClick = onClearSelection,
                            modifier = Modifier.size(30.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }
}
