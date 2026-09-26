package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.MainView
import com.example.ui.theme.YTRed

@Composable
fun BottomNavBar(
    currentView: MainView,
    onSelectView: (MainView) -> Unit,
    onOpenChannelsMenu: () -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        modifier = modifier
            .windowInsetsPadding(WindowInsets.navigationBars)
            .testTag("bottom_nav_bar"),
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp
    ) {
        // Home (All Videos)
        NavigationBarItem(
            selected = currentView == MainView.ALL,
            onClick = { onSelectView(MainView.ALL) },
            icon = {
                Icon(
                    imageVector = if (currentView == MainView.ALL) Icons.Filled.Home else Icons.Default.Home,
                    contentDescription = "Home"
                )
            },
            label = { Text("Home", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = YTRed,
                selectedTextColor = MaterialTheme.colorScheme.onSurface,
                indicatorColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            modifier = Modifier.testTag("nav_all_button")
        )

        // Shorts
        NavigationBarItem(
            selected = currentView == MainView.SHORTS,
            onClick = { onSelectView(MainView.SHORTS) },
            icon = {
                Icon(
                    imageVector = Icons.Default.PlayCircle,
                    contentDescription = "Shorts"
                )
            },
            label = { Text("Shorts", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = YTRed,
                selectedTextColor = MaterialTheme.colorScheme.onSurface,
                indicatorColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            modifier = Modifier.testTag("nav_shorts_button")
        )

        // Channels
        val isChannelsActive = currentView == MainView.CHANNEL ||
                currentView == MainView.ALL_CHANNELS ||
                currentView == MainView.SUBSCRIBED_CHANNELS ||
                currentView == MainView.VIDEOS_WITHOUT_CHANNEL
        NavigationBarItem(
            selected = isChannelsActive,
            onClick = onOpenChannelsMenu,
            icon = {
                Icon(
                    imageVector = Icons.Default.Subscriptions,
                    contentDescription = "Channels"
                )
            },
            label = { Text("Channels", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = YTRed,
                selectedTextColor = MaterialTheme.colorScheme.onSurface,
                indicatorColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            modifier = Modifier.testTag("nav_channels_button")
        )

        // Playlists (Liked, Watch Later & Custom)
        val isPlaylistActive = currentView == MainView.PLAYLIST ||
                currentView == MainView.LIKED ||
                currentView == MainView.WATCH_LATER
        NavigationBarItem(
            selected = isPlaylistActive,
            onClick = { onSelectView(MainView.PLAYLIST) },
            icon = {
                Icon(
                    imageVector = Icons.Default.PlaylistPlay,
                    contentDescription = "Playlists"
                )
            },
            label = { Text("Playlists", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = YTRed,
                selectedTextColor = MaterialTheme.colorScheme.onSurface,
                indicatorColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            modifier = Modifier.testTag("nav_playlists_button")
        )

        // History
        NavigationBarItem(
            selected = currentView == MainView.HISTORY,
            onClick = { onSelectView(MainView.HISTORY) },
            icon = {
                Icon(
                    imageVector = Icons.Default.History,
                    contentDescription = "History"
                )
            },
            label = { Text("History", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = YTRed,
                selectedTextColor = MaterialTheme.colorScheme.onSurface,
                indicatorColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            modifier = Modifier.testTag("nav_history_button")
        )

        // Settings
        NavigationBarItem(
            selected = currentView == MainView.SETTINGS,
            onClick = { onSelectView(MainView.SETTINGS) },
            icon = {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Settings"
                )
            },
            label = { Text("Settings", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = YTRed,
                selectedTextColor = MaterialTheme.colorScheme.onSurface,
                indicatorColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            modifier = Modifier.testTag("nav_settings_button")
        )
    }
}
