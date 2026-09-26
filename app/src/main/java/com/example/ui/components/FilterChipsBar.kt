package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.VideoItem
import com.example.data.model.VideoSort
import com.example.ui.theme.YTBlue
import com.example.ui.theme.YTPurple
import kotlinx.coroutines.launch

@Composable
fun FilterChipsBar(
    allVideos: List<VideoItem>,
    selectedTag: String?,
    currentSort: VideoSort,
    onSelectTag: (String?) -> Unit,
    onDeleteTag: (String) -> Unit,
    onSetSort: (VideoSort) -> Unit,
    videoCount: Int,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()
    val scope = rememberCoroutineScope()

    // Unique tags
    val tags = allVideos.flatMap { it.tags }.distinct().sorted()

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left Scroll Button
        IconButton(
            onClick = {
                scope.launch {
                    scrollState.animateScrollTo((scrollState.value - 200).coerceAtLeast(0))
                }
            },
            enabled = scrollState.value > 0,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                contentDescription = "Scroll Left",
                tint = if (scrollState.value > 0) MaterialTheme.colorScheme.onSurface else Color.Transparent
            )
        }

        Row(
            modifier = Modifier
                .weight(1f)
                .horizontalScroll(scrollState),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // "All" Chip
            FilterChip(
                selected = selectedTag == null && currentSort == VideoSort.NONE,
                onClick = {
                    onSelectTag(null)
                    onSetSort(VideoSort.NONE)
                },
                label = { Text("All", fontWeight = FontWeight.SemiBold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.onBackground,
                    selectedLabelColor = MaterialTheme.colorScheme.background,
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    labelColor = MaterialTheme.colorScheme.onBackground
                ),
                shape = RoundedCornerShape(8.dp),
                border = null,
                modifier = Modifier.testTag("chip_all")
            )

            // Dynamic Tag Chips
            tags.forEach { tag ->
                val isSelected = selectedTag.equals(tag, ignoreCase = true)
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isSelected) YTPurple else MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = if (isSelected) Color.White else MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.clip(RoundedCornerShape(8.dp))
                ) {
                    Row(
                        modifier = Modifier
                            .clickable { onSelectTag(if (isSelected) null else tag) }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Tag,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp)
                        )
                        Text(
                            text = tag,
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                        // Delete tag globally button
                        Box(
                            modifier = Modifier
                                .size(16.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = if (isSelected) 0.3f else 0.15f))
                                .clickable { onDeleteTag(tag) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Delete tag",
                                modifier = Modifier.size(10.dp),
                                tint = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Sort: Name
            FilterChip(
                selected = currentSort == VideoSort.NAME,
                onClick = { onSetSort(VideoSort.NAME) },
                label = { Text("Sort: Name") },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = YTBlue,
                    selectedLabelColor = Color.White
                ),
                shape = RoundedCornerShape(8.dp),
                border = null,
                modifier = Modifier.testTag("chip_sort_name")
            )

            // Sort: Size
            FilterChip(
                selected = currentSort == VideoSort.SIZE,
                onClick = { onSetSort(VideoSort.SIZE) },
                label = { Text("Sort: Size") },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = YTBlue,
                    selectedLabelColor = Color.White
                ),
                shape = RoundedCornerShape(8.dp),
                border = null,
                modifier = Modifier.testTag("chip_sort_size")
            )

            // Video count badge
            Text(
                text = "$videoCount videos",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 6.dp)
            )
        }

        // Right Scroll Button
        IconButton(
            onClick = {
                scope.launch {
                    scrollState.animateScrollTo(scrollState.value + 200)
                }
            },
            enabled = scrollState.value < scrollState.maxValue,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "Scroll Right",
                tint = if (scrollState.value < scrollState.maxValue) MaterialTheme.colorScheme.onSurface else Color.Transparent
            )
        }
    }
}
