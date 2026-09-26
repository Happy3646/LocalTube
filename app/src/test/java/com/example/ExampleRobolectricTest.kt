package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.data.local.LocalTubeDatabase
import com.example.data.repository.LocalTubeRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("LocalTube", appName)
  }

  @Test
  fun `repository initialization seeds channels and sample videos`() = runBlocking {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val db = LocalTubeDatabase.getDatabase(context)
    val repo = LocalTubeRepository(context, db.localTubeDao())

    repo.initializeDefaultsIfNeeded()

    val channels = repo.allChannels.first()
    assertTrue(channels.isNotEmpty())

    val videos = repo.allVideos.first()
    assertTrue(videos.isNotEmpty())

    val playlists = repo.allPlaylists.first()
    assertTrue(playlists.isNotEmpty())
  }
}

