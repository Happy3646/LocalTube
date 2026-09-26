package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.LocalTubeUiState
import com.example.ui.theme.YTBlue
import com.example.ui.theme.YTRed

@Composable
fun SettingsScreen(
    uiState: LocalTubeUiState,
    onToggleTheme: () -> Unit,
    onSetGridColumns: (Int) -> Unit,
    onOpenDuplicateDetector: () -> Unit,
    onExportJson: () -> Unit,
    onImportJson: () -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
            .testTag("settings_view"),
        contentPadding = PaddingValues(bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column {
                Text("Settings & Preferences", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Manage appearance, grid columns, duplicate detection, and backups", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // --- Card 1: Appearance & Grid Layout ---
        item {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Palette, contentDescription = null, tint = YTBlue)
                        Text("Appearance & Grid Layout", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }

                    // Theme Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Color Theme", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                            Text(if (uiState.isDarkMode) "🌙 Dark Mode" else "☀️ Light Mode", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        FilledTonalButton(
                            onClick = onToggleTheme,
                            modifier = Modifier.testTag("theme_toggle_button")
                        ) {
                            Text(if (uiState.isDarkMode) "Switch to Light" else "Switch to Dark", fontSize = 12.sp)
                        }
                    }

                    HorizontalDivider(color = MaterialTheme.colorScheme.outline)

                    // Grid Columns Selector
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Video Grid Columns", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                        Text("Choose how many columns to display in your video library", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf(1, 2, 3, 4).forEach { cols ->
                                FilterChip(
                                    selected = uiState.gridColumns == cols,
                                    onClick = { onSetGridColumns(cols) },
                                    label = { Text("$cols Col") }
                                )
                            }
                        }
                    }
                }
            }
        }

        // --- Card 2: Duplicate Video Detector ---
        item {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.FilterNone, contentDescription = null, tint = Color(0xFFF59E0B))
                        Text("Duplicate Video Detector", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }

                    Text(
                        text = "Scan video library for duplicate titles sharing 3 to 6 continuous words.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Button(
                        onClick = onOpenDuplicateDetector,
                        colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White),
                        modifier = Modifier.testTag("scan_duplicates_button")
                    ) {
                        Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Scan for Duplicates (${uiState.duplicateThreshold}+ Words)", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // --- Card 3: Data Backup & Portability ---
        item {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Backup, contentDescription = null, tint = YTBlue)
                        Text("Data Backup & Portability", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }

                    Text(
                        text = "Export and import all your custom tags, channel associations, playlists, and watch history as a JSON file.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = onExportJson,
                            modifier = Modifier.weight(1f).testTag("export_metadata_button")
                        ) {
                            Icon(Icons.Default.FileDownload, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Export JSON", fontSize = 12.sp)
                        }

                        OutlinedButton(
                            onClick = onImportJson,
                            modifier = Modifier.weight(1f).testTag("import_metadata_button")
                        ) {
                            Icon(Icons.Default.FileUpload, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Import JSON", fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // --- Card 4: User Guide & Feature Manual ---
        item {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.MenuBook, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Feature Manual & Guide", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }

                    GuideItem("⏱️ Timestamp Resume", "Remembers exact playback positions with red thumbnail progress bars. Resumes playback automatically with a toast notification.")
                    GuideItem("▶️ Up Next Auto-Play", "Streams continuous video queues when the current playback ends. Toggle on or off via the Autoplay switch.")
                    GuideItem("🏷️ Custom Tagging", "Tag any video and dynamically filter your library using interactive chips along the top.")
                    GuideItem("📜 Watch History", "Chronological logging of every watched video. Clear or manage history with a single tap.")
                    GuideItem("🤝 Channels & Collabs", "Group creators and collaboration partners with multi-creator attribution stacks and subscription management.")
                }
            }
        }
    }
}

@Composable
private fun GuideItem(title: String, desc: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
        Text(desc, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp)
    }
}
