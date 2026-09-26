package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
  primary = YTRed,
  onPrimary = Color.White,
  primaryContainer = Color(0xFF3B1212),
  onPrimaryContainer = Color(0xFFFFDAD6),
  secondary = YTBlue,
  onSecondary = Color.White,
  secondaryContainer = Color(0xFF13283E),
  onSecondaryContainer = Color(0xFFCCE5FF),
  tertiary = YTPurple,
  onTertiary = Color.White,
  background = YTDarkBg,
  onBackground = YTTextPrimary,
  surface = YTDarkSurface,
  onSurface = YTTextPrimary,
  surfaceVariant = YTDarkCard,
  onSurfaceVariant = YTTextSecondary,
  outline = YTDarkBorder
)

private val LightColorScheme = lightColorScheme(
  primary = YTRedDark,
  onPrimary = Color.White,
  primaryContainer = Color(0xFFFFDAD6),
  onPrimaryContainer = Color(0xFF410002),
  secondary = Color(0xFF065FD4),
  onSecondary = Color.White,
  secondaryContainer = Color(0xFFD6E4FF),
  onSecondaryContainer = Color(0xFF001C3B),
  tertiary = Color(0xFF7E22CE),
  onTertiary = Color.White,
  background = YTLightBg,
  onBackground = YTLightTextPrimary,
  surface = YTLightSurface,
  onSurface = YTLightTextPrimary,
  surfaceVariant = Color(0xFFEEEEEE),
  onSurfaceVariant = YTLightTextSecondary,
  outline = YTLightBorder
)

@Composable
fun MyApplicationTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit,
) {
  val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

  MaterialTheme(
    colorScheme = colorScheme,
    typography = Typography,
    content = content
  )
}

