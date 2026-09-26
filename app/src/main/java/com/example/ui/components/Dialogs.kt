package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.example.data.model.*
import com.example.ui.DuplicateGroup
import com.example.ui.theme.*
import java.util.Locale

// --- 1. Channels 4-Choice Dialog ---
@Composable
fun ChannelsChoiceDialog(
    channelsCount: Int,
    subscribedCount: Int,
    withoutChannelCount: Int,
    onNewChannel: () -> Unit,
    onSubscribedChannels: () -> Unit,
    onWithoutChannel: () -> Unit,
    onAllChannels: () -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth().testTag("channels_choice_modal")
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Subscriptions, contentDescription = null, tint = YTRed)
                        Text("Channels", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Text(
                    text = "Select an action or view to manage your creator channels and collections:",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Option 1: New Channel
                ChoiceRow(
                    title = "New Channel",
                    desc = "Create a brand new channel with custom name, avatar, and handle",
                    icon = Icons.Default.Add,
                    badgeText = null,
                    iconBgColor = YTRed.copy(alpha = 0.2f),
                    iconColor = YTRed,
                    onClick = onNewChannel
                )

                // Option 2: Subscribed Channels
                ChoiceRow(
                    title = "Subscribed Channels",
                    desc = "View feed of videos only from channels you are subscribed to",
                    icon = Icons.Default.NotificationsActive,
                    badgeText = "$subscribedCount",
                    iconBgColor = YTBlue.copy(alpha = 0.2f),
                    iconColor = YTBlue,
                    onClick = onSubscribedChannels
                )

                // Option 3: Videos Without a Channel
                ChoiceRow(
                    title = "Videos Without a Channel",
                    desc = "Unassigned videos showing default YouTube gray avatar",
                    icon = Icons.Default.PersonOutline,
                    badgeText = "$withoutChannelCount",
                    iconBgColor = Color.Gray.copy(alpha = 0.2f),
                    iconColor = Color.LightGray,
                    onClick = onWithoutChannel
                )

                // Option 4: All Channels
                ChoiceRow(
                    title = "All Channels",
                    desc = "Explore, browse, edit, and manage all your created channels",
                    icon = Icons.Default.GridView,
                    badgeText = "$channelsCount",
                    iconBgColor = YTPurple.copy(alpha = 0.2f),
                    iconColor = YTPurple,
                    onClick = onAllChannels
                )
            }
        }
    }
}

@Composable
private fun ChoiceRow(
    title: String,
    desc: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    badgeText: String?,
    iconBgColor: Color,
    iconColor: Color,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(iconBgColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(desc, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (badgeText != null) {
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(badgeText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// --- 2. Create / Edit Channel Dialog ---
@Composable
fun CreateEditChannelDialog(
    channelToEdit: ChannelItem?,
    onSave: (name: String, handle: String?, colorHex: String, description: String, logoUri: String?) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf(channelToEdit?.name ?: "") }
    var handle by remember { mutableStateOf(channelToEdit?.handle ?: "") }
    var description by remember { mutableStateOf(channelToEdit?.description ?: "") }
    var colorHex by remember { mutableStateOf(channelToEdit?.colorHex ?: "#FF0000") }
    var logoUri by remember { mutableStateOf(channelToEdit?.logoUri) }

    val presetColors = listOf(
        "#FF0000", "#065FD4", "#2BA640", "#8E24AA",
        "#FF8F00", "#00BCD4", "#E91E63", "#455A64",
        "#673AB7", "#009688", "#795548", "#D32F2F"
    )

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth().testTag("create_channel_modal")
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = if (channelToEdit != null) "Edit Channel" else "Create New Channel",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                // Preview banner
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    val parsedColor = remember(colorHex) {
                        try { Color(android.graphics.Color.parseColor(colorHex)) } catch (e: Exception) { YTRed }
                    }
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(parsedColor),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = name.take(1).ifEmpty { "C" }.uppercase(Locale.ROOT),
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                    Column {
                        Text(name.ifEmpty { "Channel Name" }, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(
                            text = if (handle.isNotBlank()) {
                                if (handle.startsWith("@")) handle else "@$handle"
                            } else "@handle",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Name input
                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        if (channelToEdit == null && handle.isBlank()) {
                            handle = "@" + it.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                        }
                    },
                    label = { Text("Channel Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("channel_name_input")
                )

                // Handle input
                OutlinedTextField(
                    value = handle,
                    onValueChange = { handle = it },
                    label = { Text("Handle (@...)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("channel_handle_input")
                )

                // Color preset swatches
                Text("Theme Color", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    presetColors.take(6).forEach { hex ->
                        val col = remember(hex) { Color(android.graphics.Color.parseColor(hex)) }
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(col)
                                .border(
                                    width = if (colorHex.equals(hex, ignoreCase = true)) 2.dp else 0.dp,
                                    color = Color.White,
                                    shape = CircleShape
                                )
                                .clickable { colorHex = hex }
                        )
                    }
                }

                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (Optional)") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth().testTag("channel_desc_input")
                )

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onSave(name, handle, colorHex, description, logoUri)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White),
                        modifier = Modifier.testTag("save_channel_button")
                    ) {
                        Text("Save Channel", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// --- 3. Assign Channel & Collabs Dialog ---
@Composable
fun AssignChannelDialog(
    videoTitle: String,
    channels: List<ChannelItem>,
    initialPrimaryId: String?,
    initialCollabIds: List<String>,
    onSave: (primaryId: String?, collabIds: List<String>) -> Unit,
    onQuickCreateChannel: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var primaryId by remember { mutableStateOf(initialPrimaryId) }
    var selectedCollabs by remember { mutableStateOf(initialCollabIds.toSet()) }
    var searchQuery by remember { mutableStateOf("") }
    var quickChannelName by remember { mutableStateOf("") }

    val filtered = remember(searchQuery, channels) {
        if (searchQuery.isBlank()) channels else {
            channels.filter { it.name.contains(searchQuery, ignoreCase = true) || it.handle.contains(searchQuery, ignoreCase = true) }
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth().testTag("assign_channel_modal")
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Channel & Collaborations", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(videoTitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)

                // Quick Search Bar
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Filter channels...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                )

                // Grid: Primary Creator (Left) & Collaborators (Right)
                Row(
                    modifier = Modifier.fillMaxWidth().height(160.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Left: Primary Channel Radio
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                            .padding(6.dp)
                    ) {
                        Text("1. Primary Creator", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = YTBlue)
                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            item {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { primaryId = null }
                                        .padding(4.dp)
                                ) {
                                    RadioButton(selected = primaryId == null, onClick = { primaryId = null })
                                    Text("None", fontSize = 12.sp)
                                }
                            }
                            items(filtered) { ch ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            primaryId = ch.id
                                            selectedCollabs = selectedCollabs - ch.id
                                        }
                                        .padding(4.dp)
                                ) {
                                    RadioButton(
                                        selected = primaryId == ch.id,
                                        onClick = {
                                            primaryId = ch.id
                                            selectedCollabs = selectedCollabs - ch.id
                                        }
                                    )
                                    Text(ch.name, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }

                    // Right: Collaborators Checkboxes
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                            .padding(6.dp)
                    ) {
                        Text("2. Collaborators", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = YTAmber)
                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            items(filtered.filter { it.id != primaryId }) { ch ->
                                val isChecked = selectedCollabs.contains(ch.id)
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selectedCollabs = if (isChecked) selectedCollabs - ch.id else selectedCollabs + ch.id
                                        }
                                        .padding(4.dp)
                                ) {
                                    Checkbox(
                                        checked = isChecked,
                                        onCheckedChange = { checked ->
                                            selectedCollabs = if (checked) selectedCollabs + ch.id else selectedCollabs - ch.id
                                        }
                                    )
                                    Text(ch.name, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }
                }

                // Attribution Preview Chip
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    val primary = channels.find { it.id == primaryId }
                    val collabsList = channels.filter { selectedCollabs.contains(it.id) }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(8.dp)
                    ) {
                        Text("Attribution:", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (primary != null) {
                            Text("${primary.name} (Creator)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = YTBlue)
                        }
                        collabsList.forEach { c ->
                            Text("× ${c.name} (Collab)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = YTAmber)
                        }
                        if (primary == null && collabsList.isEmpty()) {
                            Text("Standard Offline Video (No Channel)", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                // Quick Create Channel
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = quickChannelName,
                        onValueChange = { quickChannelName = it },
                        placeholder = { Text("New channel name...") },
                        singleLine = true,
                        modifier = Modifier.weight(1f).height(44.dp)
                    )
                    Button(
                        onClick = {
                            if (quickChannelName.isNotBlank()) {
                                onQuickCreateChannel(quickChannelName)
                                quickChannelName = ""
                            }
                        },
                        modifier = Modifier.height(38.dp)
                    ) {
                        Text("Create", fontSize = 12.sp)
                    }
                }

                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSave(primaryId, selectedCollabs.toList()) },
                        colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White)
                    ) {
                        Text("Save & Apply", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// --- 4. Tag Editor Dialog ---
@Composable
fun TagEditorDialog(
    videoTitle: String,
    currentTags: List<String>,
    allKnownTags: List<String>,
    onAddTag: (String) -> Unit,
    onRemoveTag: (String) -> Unit,
    onDeleteTagGlobally: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var tagInput by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth().testTag("tag_modal")
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Edit Video Tags", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(videoTitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)

                // Active Tags Container
                Text("Assigned Tags:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (currentTags.isEmpty()) {
                        Text("No tags assigned yet", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        currentTags.forEach { tag ->
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = YTPurple.copy(alpha = 0.2f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, YTPurple.copy(alpha = 0.5f))
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text("#$tag", fontSize = 11.sp, color = YTPurple, fontWeight = FontWeight.Bold)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Remove",
                                        tint = YTPurple,
                                        modifier = Modifier.size(12.dp).clickable { onRemoveTag(tag) }
                                    )
                                }
                            }
                        }
                    }
                }

                // Add Custom Tag Input
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = tagInput,
                        onValueChange = { tagInput = it },
                        placeholder = { Text("Tag name (e.g. Gaming, Music, Shorts)...") },
                        singleLine = true,
                        modifier = Modifier.weight(1f).height(46.dp).testTag("custom_tag_input")
                    )
                    Button(
                        onClick = {
                            if (tagInput.isNotBlank()) {
                                onAddTag(tagInput)
                                tagInput = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White),
                        modifier = Modifier.height(40.dp).testTag("add_custom_tag_button")
                    ) {
                        Text("Add", fontWeight = FontWeight.Bold)
                    }
                }

                // Quick Suggestions
                Text("Quick Suggestions:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val defaultSuggestions = listOf("Gaming", "Tutorials", "DIY", "shorts", "Music", "Science")
                    val combined = (defaultSuggestions + allKnownTags).distinct().take(6)
                    combined.forEach { sTag ->
                        val isAssigned = currentTags.any { it.equals(sTag, ignoreCase = true) }
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isAssigned) YTPurple else MaterialTheme.colorScheme.surfaceVariant,
                            contentColor = if (isAssigned) Color.White else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.clickable {
                                if (isAssigned) onRemoveTag(sTag) else onAddTag(sTag)
                            }
                        ) {
                            Text(
                                text = sTag,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Button(onClick = onDismiss, modifier = Modifier.testTag("save_tag_modal_button")) {
                        Text("Done")
                    }
                }
            }
        }
    }
}

// --- 5. Playlist Selector Dialog ---
@Composable
fun PlaylistSelectorDialog(
    videoKey: String,
    playlists: List<PlaylistItem>,
    onCreatePlaylist: (String) -> Unit,
    onToggleInPlaylist: (playlistId: String, videoKey: String) -> Unit,
    onDeletePlaylist: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var newPlaylistName by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth().testTag("playlist_modal")
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Save video to playlist...", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                // Playlist Checklist
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 180.dp)
                ) {
                    items(playlists) { pl ->
                        val isChecked = pl.videoKeys.contains(videoKey)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onToggleInPlaylist(pl.id, videoKey) }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { onToggleInPlaylist(pl.id, videoKey) }
                                )
                                Text(pl.name, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                            Text("${pl.videoKeys.size} items", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                // Create Playlist Input
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = newPlaylistName,
                        onValueChange = { newPlaylistName = it },
                        placeholder = { Text("New playlist name...") },
                        singleLine = true,
                        modifier = Modifier.weight(1f).height(46.dp)
                    )
                    Button(
                        onClick = {
                            if (newPlaylistName.isNotBlank()) {
                                onCreatePlaylist(newPlaylistName)
                                newPlaylistName = ""
                            }
                        },
                        modifier = Modifier.height(40.dp)
                    ) {
                        Text("Create")
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Button(onClick = onDismiss) { Text("Done") }
                }
            }
        }
    }
}

// --- 6. Duplicate Detector Dialog ---
@Composable
fun DuplicateDetectorDialog(
    threshold: Int,
    duplicateGroups: List<DuplicateGroup>,
    onSetThreshold: (Int) -> Unit,
    onScan: () -> Unit,
    onPlayVideo: (VideoItem) -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Duplicate Video Detector", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    text = "Detect potential duplicates sharing continuous matching words in video titles.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Threshold Buttons (3..6 Words)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(3, 4, 5, 6).forEach { num ->
                        FilterChip(
                            selected = threshold == num,
                            onClick = { onSetThreshold(num) },
                            label = { Text("$num Words") }
                        )
                    }
                }

                Button(
                    onClick = onScan,
                    colors = ButtonDefaults.buttonColors(containerColor = YTRed, contentColor = Color.White),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Search, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Scan for Duplicates ($threshold+ Words)")
                }

                // Results List
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 240.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (duplicateGroups.isEmpty()) {
                        item {
                            Text("No duplicate groups found. Try lowering threshold.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    } else {
                        items(duplicateGroups) { group ->
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("Shared phrase: \"${group.phrase}\"", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = YTAmber)
                                    group.videos.forEach { v ->
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(v.title, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                            TextButton(onClick = { onPlayVideo(v) }) {
                                                Text("Play", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Button(onClick = onDismiss) { Text("Close") }
                }
            }
        }
    }
}
