package com.example.player

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class PlayerState(
    val isPlaying: Boolean = false,
    val currentPositionMs: Long = 0L,
    val durationMs: Long = 0L,
    val isBuffering: Boolean = false,
    val isEnded: Boolean = false,
    val playbackSpeed: Float = 1.0f,
    val isLooping: Boolean = false,
    val isMuted: Boolean = false,
    val volume: Float = 1.0f,
    val errorMessage: String? = null
)

@OptIn(UnstableApi::class)
class LocalTubePlayerManager(private val context: Context) {

    private var exoPlayer: ExoPlayer? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var progressJob: Job? = null

    private val _playerState = MutableStateFlow(PlayerState())
    val playerState: StateFlow<PlayerState> = _playerState.asStateFlow()

    var onVideoEnded: (() -> Unit)? = null
    var onProgressTick: ((currentMs: Long, durationMs: Long) -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    init {
        initPlayer()
    }

    private fun initPlayer() {
        if (exoPlayer != null) return

        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 LocalTube/1.0")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(20000)

        val dataSourceFactory = DefaultDataSource.Factory(context, httpDataSourceFactory)
        val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory)

        exoPlayer = ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()
            .apply {
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        _playerState.value = _playerState.value.copy(isPlaying = isPlaying)
                        if (isPlaying) {
                            startProgressTracker()
                        } else {
                            stopProgressTracker()
                        }
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        val isBuffering = playbackState == Player.STATE_BUFFERING
                        val isEnded = playbackState == Player.STATE_ENDED
                        val duration = if (duration > 0) duration else 0L

                        _playerState.value = _playerState.value.copy(
                            isBuffering = isBuffering,
                            isEnded = isEnded,
                            durationMs = duration
                        )

                        if (isEnded) {
                            onVideoEnded?.invoke()
                        }
                    }

                    override fun onPlaybackParametersChanged(playbackParameters: PlaybackParameters) {
                        _playerState.value = _playerState.value.copy(
                            playbackSpeed = playbackParameters.speed
                        )
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        val msg = error.message ?: "Playback error"
                        _playerState.value = _playerState.value.copy(
                            isPlaying = false,
                            isBuffering = false,
                            errorMessage = msg
                        )
                        onError?.invoke(msg)
                    }
                })
            }
    }

    fun getPlayer(): ExoPlayer? {
        if (exoPlayer == null) initPlayer()
        return exoPlayer
    }

    fun playVideo(uriString: String, startPositionMs: Long = 0L) {
        val player = getPlayer() ?: return
        try {
            _playerState.value = _playerState.value.copy(errorMessage = null)
            val uri = Uri.parse(uriString)
            val mediaItem = MediaItem.fromUri(uri)
            player.setMediaItem(mediaItem)
            player.prepare()
            if (startPositionMs > 0) {
                player.seekTo(startPositionMs)
            }
            player.play()
            _playerState.value = _playerState.value.copy(
                currentPositionMs = startPositionMs,
                isEnded = false,
                errorMessage = null
            )
        } catch (e: Exception) {
            e.printStackTrace()
            _playerState.value = _playerState.value.copy(errorMessage = e.message)
        }
    }

    fun togglePlayPause() {
        val player = exoPlayer ?: return
        if (player.isPlaying) {
            player.pause()
        } else {
            if (_playerState.value.isEnded) {
                player.seekTo(0)
            }
            player.play()
        }
    }

    fun seekTo(positionMs: Long) {
        val player = exoPlayer ?: return
        val clamped = positionMs.coerceIn(0L, player.duration.coerceAtLeast(0L))
        player.seekTo(clamped)
        _playerState.value = _playerState.value.copy(currentPositionMs = clamped)
        onProgressTick?.invoke(clamped, player.duration.coerceAtLeast(0L))
    }

    fun seekBy(deltaMs: Long) {
        val player = exoPlayer ?: return
        val current = player.currentPosition
        val target = (current + deltaMs).coerceIn(0L, player.duration.coerceAtLeast(0L))
        seekTo(target)
    }

    fun setSpeed(speed: Float) {
        val player = exoPlayer ?: return
        player.setPlaybackSpeed(speed)
        _playerState.value = _playerState.value.copy(playbackSpeed = speed)
    }

    fun toggleLoop() {
        val player = exoPlayer ?: return
        val newLoop = !_playerState.value.isLooping
        player.repeatMode = if (newLoop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        _playerState.value = _playerState.value.copy(isLooping = newLoop)
    }

    fun toggleMute() {
        val player = exoPlayer ?: return
        val newMuted = !_playerState.value.isMuted
        player.volume = if (newMuted) 0f else _playerState.value.volume.coerceAtLeast(0.1f)
        _playerState.value = _playerState.value.copy(isMuted = newMuted)
    }

    fun setVolume(vol: Float) {
        val player = exoPlayer ?: return
        val clamped = vol.coerceIn(0f, 1f)
        player.volume = clamped
        _playerState.value = _playerState.value.copy(
            volume = clamped,
            isMuted = clamped == 0f
        )
    }

    private fun startProgressTracker() {
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive) {
                exoPlayer?.let { p ->
                    val pos = p.currentPosition
                    val dur = p.duration.coerceAtLeast(0L)
                    _playerState.value = _playerState.value.copy(
                        currentPositionMs = pos,
                        durationMs = dur
                    )
                    onProgressTick?.invoke(pos, dur)
                }
                delay(500)
            }
        }
    }

    private fun stopProgressTracker() {
        progressJob?.cancel()
        progressJob = null
    }

    fun release() {
        stopProgressTracker()
        scope.cancel()
        exoPlayer?.release()
        exoPlayer = null
    }
}
