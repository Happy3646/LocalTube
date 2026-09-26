package com.example

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.model.ChannelItem
import com.example.data.model.MainView
import com.example.data.model.VideoItem
import com.example.ui.DuplicateGroup
import com.example.ui.LocalTubeViewModel
import com.example.ui.components.*
import com.example.ui.screens.*
import com.example.ui.theme.MyApplicationTheme
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val viewModel: LocalTubeViewModel = viewModel()
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()
            val coroutineScope = rememberCoroutineScope()
            val context = LocalContext.current
            val snackbarHostState = remember { SnackbarHostState() }

            // Dialog Visibility States
            var showChannelsChoiceDialog by remember { mutableStateOf(false) }
            var channelToEdit by remember { mutableStateOf<ChannelItem?>(null) }
            var showCreateEditChannelDialog by remember { mutableStateOf(false) }

            var videoToAssignChannel by remember { mutableStateOf<VideoItem?>(null) }
            var showAssignChannelDialog by remember { mutableStateOf(false) }

            var videoToEditTags by remember { mutableStateOf<VideoItem?>(null) }
            var showTagEditorDialog by remember { mutableStateOf(false) }
            var isBatchTagging by remember { mutableStateOf(false) }

            var videoToSavePlaylist by remember { mutableStateOf<VideoItem?>(null) }
            var showPlaylistDialog by remember { mutableStateOf(false) }

            var videoForCustomThumbnail by remember { mutableStateOf<VideoItem?>(null) }
            var showUploadThumbnailDialog by remember { mutableStateOf(false) }

            var showDuplicateDetectorDialog by remember { mutableStateOf(false) }

            // SAF Document Picker (picks multiple videos directly)
            val openMultipleVideosLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.OpenMultipleDocuments()
            ) { uris ->
                if (uris.isNotEmpty()) {
                    for (u in uris) {
                        try {
                            contentResolver.takePersistableUriPermission(
                                u,
                                Intent.FLAG_GRANT_READ_URI_PERMISSION
                            )
                        } catch (e: Exception) {
                            // Some providers don't support persistable flags
                        }
                    }
                    viewModel.importVideosFromUris(uris)
                }
            }

            // SAF Folder Picker (picks directory tree)
            val openDocumentTreeLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.OpenDocumentTree()
            ) { treeUri ->
                if (treeUri != null) {
                    try {
                        contentResolver.takePersistableUriPermission(
                            treeUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                        )
                    } catch (e: Exception) {
                        // Ignore
                    }
                    viewModel.showToast("Folder connected: ${treeUri.lastPathSegment}")
                    viewModel.scanDeviceVideos()
                }
            }

            // Photo Picker for Custom Video Thumbnail (Zero permission required)
            val pickCustomThumbnailLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.PickVisualMedia()
            ) { uri ->
                if (uri != null && videoForCustomThumbnail != null) {
                    viewModel.setVideoCustomThumbnail(videoForCustomThumbnail!!.key, uri.toString())
                    showUploadThumbnailDialog = false
                    videoForCustomThumbnail = null
                }
            }

            // Photo Picker for Channel Logo
            val pickChannelLogoLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.PickVisualMedia()
            ) { uri ->
                if (uri != null && uiState.activeChannelId != null) {
                    val ch = uiState.channels.find { it.id == uiState.activeChannelId }
                    if (ch != null) {
                        viewModel.updateChannel(
                            id = ch.id,
                            name = ch.name,
                            handle = ch.handle,
                            colorHex = ch.colorHex,
                            description = ch.description,
                            logoUri = uri.toString()
                        )
                    }
                }
            }

            // Storage Permission launcher for MediaStore discovery
            val permissionLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.RequestPermission()
            ) { isGranted ->
                if (isGranted) {
                    viewModel.scanDeviceVideos()
                } else {
                    viewModel.showToast("Storage permission denied. You can still select videos via 'Folder'")
                }
            }

            // JSON Export Launcher
            val createExportJsonLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.CreateDocument("application/json")
            ) { uri ->
                if (uri != null) {
                    coroutineScope.launch {
                        try {
                            val jsonString = viewModel.getExportJson()
                            contentResolver.openOutputStream(uri)?.use { out ->
                                out.write(jsonString.toByteArray())
                            }
                            viewModel.showToast("Exported metadata backup to JSON!")
                        } catch (e: Exception) {
                            viewModel.showToast("Export failed: ${e.message}")
                        }
                    }
                }
            }

            // JSON Import Launcher
            val openImportJsonLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.OpenDocument()
            ) { uri ->
                if (uri != null) {
                    coroutineScope.launch {
                        try {
                            val stringBuilder = StringBuilder()
                            contentResolver.openInputStream(uri)?.use { inStream ->
                                val reader = BufferedReader(InputStreamReader(inStream))
                                var line: String? = reader.readLine()
                                while (line != null) {
                                    stringBuilder.append(line).append('\n')
                                    line = reader.readLine()
                                }
                            }
                            viewModel.importJsonMetadata(stringBuilder.toString())
                        } catch (e: Exception) {
                            viewModel.showToast("Import failed: ${e.message}")
                        }
                    }
                }
            }

            // Show Toast / Snackbar messages
            LaunchedEffect(uiState.toastMessage) {
                uiState.toastMessage?.let { msg ->
                    snackbarHostState.showSnackbar(msg)
                    viewModel.dismissToast()
                }
            }

            // Hardware Back button handling
            BackHandler(enabled = uiState.activeVideo != null || uiState.currentView != MainView.ALL) {
                if (uiState.activeVideo != null) {
                    viewModel.closePlayer()
                } else if (uiState.currentView != MainView.ALL) {
                    viewModel.selectView(MainView.ALL)
                }
            }

            MyApplicationTheme(darkTheme = uiState.isDarkMode) {
                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    snackbarHost = { SnackbarHost(snackbarHostState) },
                    topBar = {
                        if (uiState.activeVideo == null) {
                            TopBar(
                                uiState = uiState,
                                onSearchChange = { viewModel.updateSearchQuery(it) },
                                onSearchSubmit = { viewModel.executeSearch(it) },
                                onClearSearch = { viewModel.clearSearch() },
                                onSuggestionClick = { suggestion ->
                                    if (suggestion.channelId != null) {
                                        viewModel.openChannel(suggestion.channelId)
                                    } else {
                                        viewModel.executeSearch(suggestion.title)
                                    }
                                },
                                onRemoveHistoryQuery = { viewModel.removeSearchQuery(it) },
                                onToggleShuffle = { viewModel.toggleShuffle() },
                                onScanFolderClick = {
                                    // Trigger open multiple documents or folder picker
                                    openMultipleVideosLauncher.launch(arrayOf("video/*"))
                                },
                                onBackClick = { viewModel.closePlayer() },
                                onHomeClick = {
                                    viewModel.clearSearch()
                                    viewModel.selectTagFilter(null)
                                    viewModel.selectView(MainView.ALL)
                                }
                            )
                        }
                    },
                    bottomBar = {
                        if (uiState.activeVideo == null) {
                            BottomNavBar(
                                currentView = uiState.currentView,
                                onSelectView = { viewModel.selectView(it) },
                                onOpenChannelsMenu = { showChannelsChoiceDialog = true }
                            )
                        }
                    }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        // If actively playing a video, show Watch Stage
                        if (uiState.activeVideo != null) {
                            WatchStage(
                                video = uiState.activeVideo!!,
                                playerManager = viewModel.playerManager,
                                channels = uiState.channels,
                                isLiked = uiState.userInteractions[uiState.activeVideo!!.key]?.isLiked == true,
                                isDisliked = uiState.userInteractions[uiState.activeVideo!!.key]?.isDisliked == true,
                                isWatchLater = uiState.userInteractions[uiState.activeVideo!!.key]?.isWatchLater == true,
                                resumeToastText = uiState.resumeToastMessage,
                                upNextQueue = uiState.upNextQueue,
                                autoplayEnabled = uiState.autoplayEnabled,
                                onAutoplayChange = { viewModel.setAutoplay(it) },
                                onPlayNext = { viewModel.playNextVideo() },
                                onPlayPrevious = { viewModel.playPreviousVideo() },
                                onPlayVideo = { viewModel.playVideo(it) },
                                onMixUpNext = { viewModel.mixUpNextQueue() },
                                onToggleLike = { viewModel.toggleLike(uiState.activeVideo!!.key) },
                                onToggleDislike = { viewModel.toggleDislike(uiState.activeVideo!!.key) },
                                onToggleWatchLater = { viewModel.toggleWatchLater(uiState.activeVideo!!.key) },
                                onSaveToPlaylistClick = {
                                    videoToSavePlaylist = uiState.activeVideo
                                    showPlaylistDialog = true
                                },
                                onOpenChannelClick = { chId ->
                                    viewModel.closePlayer()
                                    viewModel.openChannel(chId)
                                },
                                onSubscribeChannelClick = { chId ->
                                    viewModel.toggleChannelSubscription(chId)
                                },
                                onAddTag = { tag ->
                                    viewModel.addTag(uiState.activeVideo!!.key, tag)
                                },
                                onRemoveTag = { tag ->
                                    viewModel.removeTag(uiState.activeVideo!!.key, tag)
                                },
                                onOpenAssignChannel = {
                                    videoToAssignChannel = uiState.activeVideo
                                    showAssignChannelDialog = true
                                },
                                onOpenTagEditor = {
                                    videoToEditTags = uiState.activeVideo
                                    isBatchTagging = false
                                    showTagEditorDialog = true
                                },
                                onOpenUploadThumbnail = {
                                    videoForCustomThumbnail = uiState.activeVideo
                                    pickCustomThumbnailLauncher.launch(
                                        androidx.activity.result.PickVisualMediaRequest(
                                            ActivityResultContracts.PickVisualMedia.ImageOnly
                                        )
                                    )
                                },
                                onBackToBrowseClick = { viewModel.closePlayer() }
                            )
                        } else {
                            // Primary Screen Switcher
                            when (uiState.currentView) {
                                MainView.SHORTS -> {
                                    ShortsFeed(
                                        shortsVideos = uiState.filteredVideos,
                                        channels = uiState.channels,
                                        isLiked = { key -> uiState.userInteractions[key]?.isLiked == true },
                                        isDisliked = { key -> uiState.userInteractions[key]?.isDisliked == true },
                                        onToggleLike = { key -> viewModel.toggleLike(key) },
                                        onToggleDislike = { key -> viewModel.toggleDislike(key) },
                                        onPlaylistClick = { v ->
                                            videoToSavePlaylist = v
                                            showPlaylistDialog = true
                                        },
                                        onTagsClick = { v ->
                                            videoToEditTags = v
                                            isBatchTagging = false
                                            showTagEditorDialog = true
                                        },
                                        onChannelClick = { chId -> viewModel.openChannel(chId) }
                                    )
                                }
                                MainView.PLAYLIST -> {
                                    PlaylistsScreen(
                                        uiState = uiState,
                                        onSelectView = { viewModel.selectView(it) },
                                        onOpenPlaylist = { plId -> viewModel.openPlaylist(plId) },
                                        onCreatePlaylistClick = {
                                            videoToSavePlaylist = null
                                            showPlaylistDialog = true
                                        },
                                        onDeletePlaylist = { plId -> viewModel.deletePlaylist(plId) }
                                    )
                                }
                                MainView.HISTORY -> {
                                    HistoryScreen(
                                        uiState = uiState,
                                        onPlayVideo = { viewModel.playVideo(it) },
                                        onRemoveFromHistory = { key -> viewModel.deleteHistoryForVideo(key) },
                                        onClearHistory = { viewModel.clearHistory() }
                                    )
                                }
                                MainView.SETTINGS -> {
                                    SettingsScreen(
                                        uiState = uiState,
                                        onToggleTheme = { viewModel.toggleDarkMode() },
                                        onSetGridColumns = { viewModel.setGridColumns(it) },
                                        onOpenDuplicateDetector = {
                                            viewModel.scanDuplicates()
                                            showDuplicateDetectorDialog = true
                                        },
                                        onExportJson = {
                                            createExportJsonLauncher.launch("localtube-backup-${System.currentTimeMillis()}.json")
                                        },
                                        onImportJson = {
                                            openImportJsonLauncher.launch(arrayOf("application/json", "*/*"))
                                        }
                                    )
                                }
                                MainView.ALL_CHANNELS -> {
                                    ChannelsDirectoryView(
                                        channels = uiState.channels,
                                        allVideos = uiState.allVideos,
                                        onOpenChannel = { chId -> viewModel.openChannel(chId) },
                                        onToggleSubscribe = { chId -> viewModel.toggleChannelSubscription(chId) },
                                        onCreateChannelClick = {
                                            channelToEdit = null
                                            showCreateEditChannelDialog = true
                                        }
                                    )
                                }
                                MainView.CHANNEL -> {
                                    val currentChannel = uiState.channels.find { it.id == uiState.activeChannelId }
                                    if (currentChannel != null) {
                                        Column(modifier = Modifier.fillMaxSize()) {
                                            ChannelHeroView(
                                                channel = currentChannel,
                                                channelVideos = uiState.filteredVideos,
                                                isSubscribed = currentChannel.isSubscribed,
                                                onSubscribeToggle = { viewModel.toggleChannelSubscription(currentChannel.id) },
                                                onAddVideosClick = {
                                                    // Allow batch assigning videos
                                                    viewModel.selectView(MainView.VIDEOS_WITHOUT_CHANNEL)
                                                    viewModel.showToast("Select videos to add to ${currentChannel.name}")
                                                },
                                                onEditChannelClick = {
                                                    channelToEdit = currentChannel
                                                    showCreateEditChannelDialog = true
                                                },
                                                onDeleteChannelClick = {
                                                    viewModel.deleteChannel(currentChannel.id)
                                                },
                                                onPickLogoClick = {
                                                    pickChannelLogoLauncher.launch(
                                                        androidx.activity.result.PickVisualMediaRequest(
                                                            ActivityResultContracts.PickVisualMedia.ImageOnly
                                                        )
                                                    )
                                                }
                                            )

                                            HomeScreen(
                                                uiState = uiState,
                                                onVideoClick = { viewModel.playVideo(it) },
                                                onChannelClick = { chId -> viewModel.openChannel(chId) },
                                                onTagClick = { tag -> viewModel.selectTagFilter(tag) },
                                                onEditTagsClick = { v ->
                                                    videoToEditTags = v
                                                    isBatchTagging = false
                                                    showTagEditorDialog = true
                                                },
                                                onAssignChannelClick = { v ->
                                                    videoToAssignChannel = v
                                                    showAssignChannelDialog = true
                                                },
                                                onToggleLike = { v -> viewModel.toggleLike(v.key) },
                                                onToggleWatchLater = { v -> viewModel.toggleWatchLater(v.key) },
                                                onAddToPlaylistClick = { v ->
                                                    videoToSavePlaylist = v
                                                    showPlaylistDialog = true
                                                },
                                                onUploadThumbnailClick = { v ->
                                                    videoForCustomThumbnail = v
                                                    pickCustomThumbnailLauncher.launch(
                                                        androidx.activity.result.PickVisualMediaRequest(
                                                            ActivityResultContracts.PickVisualMedia.ImageOnly
                                                        )
                                                    )
                                                },
                                                onToggleSelection = { key -> viewModel.toggleVideoSelection(key) },
                                                onSelectAllVisible = { viewModel.selectAllVisibleVideos() },
                                                onClearSelection = { viewModel.clearVideoSelection() },
                                                onBatchTagClick = {
                                                    isBatchTagging = true
                                                    showTagEditorDialog = true
                                                },
                                                onBatchChannelClick = {
                                                    videoToAssignChannel = null
                                                    showAssignChannelDialog = true
                                                },
                                                onSelectTagFilter = { viewModel.selectTagFilter(it) },
                                                onDeleteTagGlobally = { viewModel.deleteTagGlobally(it) },
                                                onSetSort = { viewModel.setSort(it) },
                                                onScanFolderClick = {
                                                    openMultipleVideosLauncher.launch(arrayOf("video/*"))
                                                }
                                            )
                                        }
                                    } else {
                                        viewModel.selectView(MainView.ALL_CHANNELS)
                                    }
                                }
                                else -> {
                                    // Default Home / Filtered View (ALL, LIKED, WATCH_LATER, UNTAGGED, SUBSCRIBED_CHANNELS, VIDEOS_WITHOUT_CHANNEL)
                                    HomeScreen(
                                        uiState = uiState,
                                        onVideoClick = { viewModel.playVideo(it) },
                                        onChannelClick = { chId -> viewModel.openChannel(chId) },
                                        onTagClick = { tag -> viewModel.selectTagFilter(tag) },
                                        onEditTagsClick = { v ->
                                            videoToEditTags = v
                                            isBatchTagging = false
                                            showTagEditorDialog = true
                                        },
                                        onAssignChannelClick = { v ->
                                            videoToAssignChannel = v
                                            showAssignChannelDialog = true
                                        },
                                        onToggleLike = { v -> viewModel.toggleLike(v.key) },
                                        onToggleWatchLater = { v -> viewModel.toggleWatchLater(v.key) },
                                        onAddToPlaylistClick = { v ->
                                            videoToSavePlaylist = v
                                            showPlaylistDialog = true
                                        },
                                        onUploadThumbnailClick = { v ->
                                            videoForCustomThumbnail = v
                                            pickCustomThumbnailLauncher.launch(
                                                androidx.activity.result.PickVisualMediaRequest(
                                                    ActivityResultContracts.PickVisualMedia.ImageOnly
                                                )
                                            )
                                        },
                                        onToggleSelection = { key -> viewModel.toggleVideoSelection(key) },
                                        onSelectAllVisible = { viewModel.selectAllVisibleVideos() },
                                        onClearSelection = { viewModel.clearVideoSelection() },
                                        onBatchTagClick = {
                                            isBatchTagging = true
                                            showTagEditorDialog = true
                                        },
                                        onBatchChannelClick = {
                                            videoToAssignChannel = null
                                            showAssignChannelDialog = true
                                        },
                                        onSelectTagFilter = { viewModel.selectTagFilter(it) },
                                        onDeleteTagGlobally = { viewModel.deleteTagGlobally(it) },
                                        onSetSort = { viewModel.setSort(it) },
                                        onScanFolderClick = {
                                            openMultipleVideosLauncher.launch(arrayOf("video/*"))
                                        }
                                    )
                                }
                            }
                        }
                    }
                }

                // --- DIALOGS ---

                // 1. Channels Choice Dialog (4 Choices)
                if (showChannelsChoiceDialog) {
                    val subCount = uiState.channels.count { it.isSubscribed }
                    val noChCount = uiState.allVideos.count { it.channelId == null && it.collabChannelIds.isEmpty() }
                    ChannelsChoiceDialog(
                        channelsCount = uiState.channels.size,
                        subscribedCount = subCount,
                        withoutChannelCount = noChCount,
                        onNewChannel = {
                            showChannelsChoiceDialog = false
                            channelToEdit = null
                            showCreateEditChannelDialog = true
                        },
                        onSubscribedChannels = {
                            showChannelsChoiceDialog = false
                            viewModel.selectView(MainView.SUBSCRIBED_CHANNELS)
                        },
                        onWithoutChannel = {
                            showChannelsChoiceDialog = false
                            viewModel.selectView(MainView.VIDEOS_WITHOUT_CHANNEL)
                        },
                        onAllChannels = {
                            showChannelsChoiceDialog = false
                            viewModel.selectView(MainView.ALL_CHANNELS)
                        },
                        onDismiss = { showChannelsChoiceDialog = false }
                    )
                }

                // 2. Create / Edit Channel Dialog
                if (showCreateEditChannelDialog) {
                    CreateEditChannelDialog(
                        channelToEdit = channelToEdit,
                        onSave = { name, handle, colorHex, desc, logo ->
                            if (channelToEdit != null) {
                                viewModel.updateChannel(channelToEdit!!.id, name, handle ?: "@$name", colorHex, desc, logo)
                            } else {
                                viewModel.createChannel(name, handle, colorHex, desc, logo)
                            }
                            showCreateEditChannelDialog = false
                            channelToEdit = null
                        },
                        onDismiss = {
                            showCreateEditChannelDialog = false
                            channelToEdit = null
                        }
                    )
                }

                // 3. Assign Channel & Collabs Dialog
                if (showAssignChannelDialog) {
                    val targetVideo = videoToAssignChannel
                    AssignChannelDialog(
                        videoTitle = targetVideo?.title ?: "${uiState.selectedVideoKeys.size} selected videos",
                        channels = uiState.channels,
                        initialPrimaryId = targetVideo?.channelId,
                        initialCollabIds = targetVideo?.collabChannelIds ?: emptyList(),
                        onSave = { primaryId, collabIds ->
                            if (targetVideo != null) {
                                viewModel.assignVideoChannel(targetVideo.key, primaryId, collabIds)
                            } else {
                                viewModel.batchAssignChannel(primaryId, collabIds)
                            }
                            showAssignChannelDialog = false
                            videoToAssignChannel = null
                        },
                        onQuickCreateChannel = { qName ->
                            viewModel.createChannel(qName, null, "#FF0000", "")
                        },
                        onDismiss = {
                            showAssignChannelDialog = false
                            videoToAssignChannel = null
                        }
                    )
                }

                // 4. Tag Editor Dialog
                if (showTagEditorDialog) {
                    val targetVideo = videoToEditTags
                    val currentTags = if (isBatchTagging) emptyList() else targetVideo?.tags ?: emptyList()
                    val allTags = uiState.allVideos.flatMap { it.tags }.distinct()

                    TagEditorDialog(
                        videoTitle = if (isBatchTagging) "${uiState.selectedVideoKeys.size} selected videos" else targetVideo?.title ?: "Video",
                        currentTags = currentTags,
                        allKnownTags = allTags,
                        onAddTag = { tag ->
                            if (isBatchTagging) {
                                viewModel.batchAddTag(tag)
                            } else if (targetVideo != null) {
                                viewModel.addTag(targetVideo.key, tag)
                            }
                        },
                        onRemoveTag = { tag ->
                            if (targetVideo != null) {
                                viewModel.removeTag(targetVideo.key, tag)
                            }
                        },
                        onDeleteTagGlobally = { tag ->
                            viewModel.deleteTagGlobally(tag)
                        },
                        onDismiss = {
                            showTagEditorDialog = false
                            videoToEditTags = null
                            isBatchTagging = false
                        }
                    )
                }

                // 5. Playlist Selector Dialog
                if (showPlaylistDialog) {
                    PlaylistSelectorDialog(
                        videoKey = videoToSavePlaylist?.key ?: "",
                        playlists = uiState.playlists,
                        onCreatePlaylist = { name -> viewModel.createPlaylist(name) },
                        onToggleInPlaylist = { plId, vKey -> viewModel.toggleVideoInPlaylist(plId, vKey) },
                        onDeletePlaylist = { plId -> viewModel.deletePlaylist(plId) },
                        onDismiss = {
                            showPlaylistDialog = false
                            videoToSavePlaylist = null
                        }
                    )
                }

                // 6. Duplicate Detector Dialog
                if (showDuplicateDetectorDialog) {
                    DuplicateDetectorDialog(
                        threshold = uiState.duplicateThreshold,
                        duplicateGroups = uiState.duplicateGroups,
                        onSetThreshold = { viewModel.setDuplicateThreshold(it) },
                        onScan = { viewModel.scanDuplicates() },
                        onPlayVideo = { v ->
                            showDuplicateDetectorDialog = false
                            viewModel.playVideo(v)
                        },
                        onDismiss = { showDuplicateDetectorDialog = false }
                    )
                }
            }
        }
    }
}
