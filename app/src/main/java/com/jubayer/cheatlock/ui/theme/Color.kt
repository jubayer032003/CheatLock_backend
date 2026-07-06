package com.jubayer.cheatlock.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * CheatLock Premium Palette — Navy Blue & Light Purple
 * Professional, clean, and advanced enterprise aesthetic.
 */

// Brand Colors
val CheatLockNavyDeep = Color(0xFF0A0F1D)    // Deepest Midnight Navy
val CheatLockNavyRich = Color(0xFF111827)    // Rich Slate Navy
val CheatLockNavySurface = Color(0xFF1F2937) // Modern Navy Surface
val CheatLockNavyBorder = Color(0xFF374151)  // Slate Navy Border

val CheatLockPurpleVibrant = Color(0xFF8B5CF6) // Primary Light Purple
val CheatLockPurpleSoft = Color(0xFFA78BFA)    // Soft Accent Purple
val CheatLockPurpleDeep = Color(0xFF6D28D9)    // Deep Royal Purple

val CheatLockWhite = Color(0xFFFFFFFF)
val CheatLockOffWhite = Color(0xFFF9FAFB)      // Clean Off-White

// Semantic Status
val CheatLockSuccess = Color(0xFF10B981)       // Emerald Green
val CheatLockWarning = Color(0xFFF59E0B)       // Amber Yellow
val CheatLockDanger = Color(0xFFEF4444)        // Modern Red
val CheatLockInfo = Color(0xFF3B82F6)          // Bright Blue

// Legacy Compatibility (mapping old names to new palette)
val CheatLockRed = CheatLockPurpleVibrant
val CheatLockRedSoft = CheatLockPurpleSoft
val CheatLockRedDeep = CheatLockPurpleDeep
val CheatLockRedGlow = CheatLockPurpleVibrant.copy(alpha = 0.15f)

val CheatLockGray950 = CheatLockNavyDeep
val CheatLockGray900 = CheatLockNavyRich
val CheatLockGray800 = CheatLockNavySurface
val CheatLockGray700 = Color(0xFF374151)
val CheatLockGray600 = Color(0xFF4B5563)
val CheatLockGray500 = Color(0xFF6B7280)
val CheatLockGray400 = Color(0xFF9CA3AF)
val CheatLockGray300 = Color(0xFFD1D5DB)

// Layout Aliases
val CheatLockDarkBackground = CheatLockNavyDeep
val CheatLockDarkSurface = CheatLockNavyRich
val CheatLockDarkSurfaceHigh = CheatLockNavySurface
val CheatLockDarkSurfaceGlass = CheatLockNavyRich.copy(alpha = 0.85f)

val CheatLockTextPrimaryDark = CheatLockWhite
val CheatLockTextSecondaryDark = Color(0xFF9CA3AF)
val CheatLockTextTertiaryDark = Color(0xFF6B7280)

val CheatLockAccent = CheatLockPurpleSoft
val CheatLockAccentSoft = Color(0xFFDDD6FE) // Lightest purple for highlights

val CheatLockGlassBorder = Color(0x1AFFFFFF)
val CheatLockGlassHighlight = Color(0x08FFFFFF)

val CheatLockGradientStart = CheatLockPurpleVibrant
val CheatLockGradientMid = CheatLockPurpleSoft
val CheatLockGradientEnd = CheatLockNavyRich
val CheatLockOutline = CheatLockNavyBorder

// Specific Theme Palettes
// LIGHT MODE: Background: #F8FAFC, Surface: #FFFFFF, Primary: #1E3A8A, Secondary: #7C3AED, Text: #111827
val CheatLockLightBackground = Color(0xFFF8FAFC)
val CheatLockLightSurface = Color(0xFFFFFFFF)
val CheatLockLightPrimary = Color(0xFF1E3A8A)
val CheatLockLightSecondary = Color(0xFF7C3AED)
val CheatLockLightText = Color(0xFF111827)

// DARK MODE: Background: #0F172A, Surface: #1E293B, Primary: #3B82F6, Secondary: #A855F7, Text: #F8FAFC
val CheatLockDarkBackgroundNew = Color(0xFF0F172A)
val CheatLockDarkSurfaceNew = Color(0xFF1E293B)
val CheatLockDarkPrimaryNew = Color(0xFF3B82F6)
val CheatLockDarkSecondaryNew = Color(0xFFA855F7)
val CheatLockDarkTextNew = Color(0xFFF8FAFC)
