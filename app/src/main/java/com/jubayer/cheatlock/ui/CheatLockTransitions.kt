package com.jubayer.cheatlock.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable

private const val ScreenInMs = 500
private const val ScreenOutMs = 400
private const val TabInMs = 350
private const val TabOutMs = 250

/**
 * High-end cinematic screen transition for CheatLock.
 * Uses a deep parallax scale + slide + fade for an advanced enterprise feel.
 */
fun cheatLockScreenTransition(): ContentTransform {
    return (fadeIn(animationSpec = tween(ScreenInMs, easing = FastOutSlowInEasing)) +
            slideInHorizontally(animationSpec = tween(ScreenInMs, easing = FastOutSlowInEasing)) { fullWidth -> fullWidth / 10 } +
            scaleIn(initialScale = 0.92f, animationSpec = tween(ScreenInMs, easing = FastOutSlowInEasing)))
        .togetherWith(
            fadeOut(animationSpec = tween(ScreenOutMs)) +
                slideOutHorizontally(animationSpec = tween(ScreenOutMs)) { fullWidth -> -fullWidth / 10 } +
                scaleOut(targetScale = 1.05f, animationSpec = tween(ScreenOutMs))
        )
}

/**
 * Professional directional tab transition for inner dashboard navigation.
 */
fun cheatLockTabTransition(
    forward: Boolean
): ContentTransform {
    val enterOffset: (Int) -> Int = { fullWidth -> if (forward) fullWidth / 8 else -fullWidth / 8 }
    val exitOffset: (Int) -> Int = { fullWidth -> if (forward) -fullWidth / 8 else fullWidth / 8 }

    return (fadeIn(animationSpec = tween(TabInMs, easing = FastOutSlowInEasing)) +
            slideInHorizontally(animationSpec = tween(TabInMs, easing = FastOutSlowInEasing), initialOffsetX = enterOffset))
        .togetherWith(
            fadeOut(animationSpec = tween(TabOutMs)) +
                slideOutHorizontally(animationSpec = tween(TabOutMs), targetOffsetX = exitOffset)
        )
}
