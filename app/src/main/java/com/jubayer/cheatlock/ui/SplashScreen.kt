package com.jubayer.cheatlock.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jubayer.cheatlock.ui.theme.CheatLockDarkBackground
import com.jubayer.cheatlock.ui.theme.CheatLockGray400
import com.jubayer.cheatlock.ui.theme.CheatLockNavyRich
import com.jubayer.cheatlock.ui.theme.CheatLockPurpleDeep
import com.jubayer.cheatlock.ui.theme.CheatLockPurpleSoft
import com.jubayer.cheatlock.ui.theme.CheatLockPurpleVibrant
import com.jubayer.cheatlock.util.BackendConnectionProbe
import com.jubayer.cheatlock.model.UserAccount
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(
    initialUrl: String,
    onProbingComplete: (resolvedUrl: String, authenticatedUser: UserAccount?) -> Unit,
    onValidateSession: suspend (String) -> UserAccount?
) {
    val context = LocalContext.current
    var currentStepText by remember { mutableStateOf("Initializing secure sandbox...") }
    var progressVal by remember { mutableFloatStateOf(0f) }

    // Sequential fade in animations
    val contentAlpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch {
            contentAlpha.animateTo(1f, tween(1200, easing = FastOutSlowInEasing))
        }

        // Animated progress incrementer
        launch {
            while (progressVal < 1f) {
                delay(30)
                if (progressVal < 0.25f) {
                    progressVal += 0.012f
                } else if (progressVal < 0.60f) {
                    progressVal += 0.007f
                } else if (progressVal < 0.90f) {
                    progressVal += 0.004f
                } else {
                    progressVal += 0.0015f
                }
            }
        }

        // Sub-tasks display
        launch {
            delay(1000)
            currentStepText = "Checking biometric module..."
            delay(1000)
            currentStepText = "Initializing proctoring engine..."
            delay(1000)
            currentStepText = "Connecting to secure node..."
            delay(800)
            currentStepText = "Handshake complete. Entering..."
        }

        // Probing backend server
        launch {
            var workingUrl: String? = null
            try {
                if (BackendConnectionProbe.ping(initialUrl)) {
                    workingUrl = initialUrl
                } else {
                    val working = BackendConnectionProbe.findWorkingUrl(context)
                    if (working != null) {
                        workingUrl = working
                    }
                }
            } catch (e: Exception) {
                // Fallback
            }

            val finalUrl = workingUrl ?: initialUrl
            
            currentStepText = "Verifying security credentials..."
            val user = onValidateSession(finalUrl)

            delay(1000)
            progressVal = 1.0f
            delay(300)

            onProbingComplete(finalUrl, user)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CheatLockDarkBackground)
    ) {
        SplashAmbientNebula()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Rotating Scanner Ring
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(160.dp)
                    .scale(contentAlpha.value)
            ) {
                SplashScannerRing()
                
                // Pulsing Vector Emblem
                Image(
                    painter = painterResource(id = com.jubayer.cheatlock.R.drawable.ic_logo_emblem),
                    contentDescription = "CheatLock Logo",
                    modifier = Modifier.size(90.dp)
                )
            }

            Spacer(modifier = Modifier.height(48.dp))

            SparklingBrandText(text = "CHEATLOCK")

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "SECURE EXAM FRAMEWORK",
                style = MaterialTheme.typography.labelSmall.copy(
                    color = CheatLockPurpleSoft.copy(alpha = 0.8f),
                    letterSpacing = 4.sp
                ),
                modifier = Modifier.scale(contentAlpha.value)
            )

            Spacer(modifier = Modifier.height(100.dp))

            // Progress Section
            Column(
                modifier = Modifier
                    .width(280.dp)
                    .scale(contentAlpha.value),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                AnimatedContent(
                    targetState = currentStepText,
                    transitionSpec = {
                        (fadeIn(animationSpec = tween(400)) + scaleIn(initialScale = 0.98f)) togetherWith
                                (fadeOut(animationSpec = tween(300)) + scaleOut(targetScale = 0.98f))
                    },
                    label = "statusText"
                ) { stepText ->
                    Text(
                        text = stepText,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            color = CheatLockGray400,
                            fontWeight = FontWeight.Medium
                        ),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                val animatedProgress by animateFloatAsState(
                    targetValue = progressVal,
                    animationSpec = tween(durationMillis = 250, easing = LinearEasing),
                    label = "progressBar"
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(CheatLockNavyRich)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(animatedProgress)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(2.dp))
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(CheatLockPurpleDeep, CheatLockPurpleVibrant, CheatLockPurpleSoft)
                                )
                            )
                    )
                }
            }
        }
    }
}

@Composable
private fun SplashScannerRing() {
    val transition = rememberInfiniteTransition(label = "scanner")
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(5000, easing = LinearEasing)
        ),
        label = "rotation"
    )
    val scalePulse by transition.animateFloat(
        initialValue = 1f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(2500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scalePulse"
    )

    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .scale(scalePulse)
    ) {
        val strokeWidth = 2.dp.toPx()

        drawCircle(
            color = CheatLockPurpleVibrant.copy(alpha = 0.12f),
            style = Stroke(
                width = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(16f, 16f), 0f)
            )
        )

        withTransform({
            rotate(degrees = rotation)
        }) {
            drawArc(
                color = CheatLockPurpleVibrant,
                startAngle = 0f,
                sweepAngle = 120f,
                useCenter = false,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
            )

            drawArc(
                color = CheatLockPurpleSoft.copy(alpha = 0.5f),
                startAngle = 200f,
                sweepAngle = 60f,
                useCenter = false,
                style = Stroke(width = strokeWidth - 1f, cap = StrokeCap.Round)
            )
        }
    }
}

@Composable
private fun SplashAmbientNebula() {
    val transition = rememberInfiniteTransition(label = "nebula")
    val driftA by transition.animateFloat(
        initialValue = 0f,
        targetValue = 40f,
        animationSpec = infiniteRepeatable(
            animation = tween(8000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "driftA"
    )
    val driftB by transition.animateFloat(
        initialValue = 0f,
        targetValue = -40f,
        animationSpec = infiniteRepeatable(
            animation = tween(10000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "driftB"
    )

    Canvas(modifier = Modifier.fillMaxSize()) {
        val width = size.width
        val height = size.height

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(CheatLockPurpleVibrant.copy(alpha = 0.10f), Color.Transparent),
                center = Offset(width * 0.15f + driftA.dp.toPx(), height * 0.2f + driftB.dp.toPx()),
                radius = width * 0.8f
            )
        )

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(CheatLockPurpleDeep.copy(alpha = 0.08f), Color.Transparent),
                center = Offset(width * 0.85f + driftB.dp.toPx(), height * 0.8f + driftA.dp.toPx()),
                radius = width * 0.8f
            )
        )
    }
}
