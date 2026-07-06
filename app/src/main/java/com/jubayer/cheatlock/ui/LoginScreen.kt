package com.jubayer.cheatlock.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import com.jubayer.cheatlock.model.UserAccount
import com.jubayer.cheatlock.model.UserRole
import com.jubayer.cheatlock.ui.theme.*
import com.jubayer.cheatlock.util.IdentifierNormalizer
import kotlinx.coroutines.launch

/**
 * Professional Login & Registration Screen
 * Clean, simple layout with Navy Blue & Light Purple theme.
 */

@Composable
fun LoginScreen(
    serverUrl: String,
    configuredServerUrl: String,
    initialSignupMode: Boolean = false,
    onBackToHome: () -> Unit = {},
    onServerUrlSave: (String) -> Unit,
    onTestServerConnection: suspend (String) -> Result<String>,
    onLogin: suspend (String, String, UserRole) -> UserAccount,
    onSignup: suspend (UserAccount) -> UserAccount,
    onSignupSuccess: (UserAccount) -> Unit = {},
    onStudentLogin: (UserAccount) -> Unit,
    onTeacherLogin: (UserAccount) -> Unit,
    externalMessage: String? = null
) {
    val scope = rememberCoroutineScope()
    var isSignupMode by remember { mutableStateOf(initialSignupMode) }
    var selectedRole by remember { mutableStateOf(UserRole.STUDENT) }
    var name by remember { mutableStateOf("") }
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    PremiumScreen(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Additional Decorative Nebula for Login only
            LoginDecorativeNebula()

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 40.dp)
                    .verticalScroll(rememberScrollState())
                    .imePadding(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(28.dp)
            ) {
                // Premium Animated Header
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                        horizontalArrangement = Arrangement.Start
                    ) {
                        IconButton(
                            onClick = onBackToHome,
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.05f))
                        ) {
                            Icon(Icons.Default.ArrowBack, "Back", tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                    }
                    
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(130.dp)) {
                        val transition = rememberInfiniteTransition(label = "rings")
                        val rotation by transition.animateFloat(
                            initialValue = 0f, targetValue = 360f,
                            animationSpec = infiniteRepeatable(tween(8000, easing = LinearEasing)),
                            label = "rotation"
                        )
                        val pulse by transition.animateFloat(
                            initialValue = 1f, targetValue = 1.1f,
                            animationSpec = infiniteRepeatable(tween(2000, easing = FastOutSlowInEasing), RepeatMode.Reverse),
                            label = "pulse"
                        )
                        
                        Canvas(modifier = Modifier.fillMaxSize().scale(pulse)) {
                            drawCircle(
                                color = CheatLockPurpleVibrant.copy(alpha = 0.1f),
                                style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 12f), 0f))
                            )
                            rotate(rotation) {
                                drawArc(
                                    color = CheatLockPurpleVibrant,
                                    startAngle = 0f, sweepAngle = 120f, useCenter = false,
                                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                                )
                                drawArc(
                                    color = CheatLockPurpleSoft.copy(alpha = 0.5f),
                                    startAngle = 200f, sweepAngle = 60f, useCenter = false,
                                    style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
                                )
                            }
                        }
                        
                        Image(
                            painter = painterResource(id = com.jubayer.cheatlock.R.drawable.ic_logo_emblem),
                            contentDescription = "CheatLock Emblem",
                            modifier = Modifier.size(72.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    SparklingBrandText(text = "CHEATLOCK", style = MaterialTheme.typography.displaySmall)
                    Text(
                        text = "Professional Exam Integrity System",
                        style = MaterialTheme.typography.labelSmall,
                        color = CheatLockTextSecondaryDark,
                        letterSpacing = 2.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                // Main Auth Card
                AnimatedContent(
                    targetState = isSignupMode,
                    transitionSpec = {
                        if (targetState) {
                            (slideInHorizontally { it } + fadeIn()).togetherWith(slideOutHorizontally { -it } + fadeOut())
                        } else {
                            (slideInHorizontally { -it } + fadeIn()).togetherWith(slideOutHorizontally { it } + fadeOut())
                        }.using(SizeTransform(clip = false))
                    },
                    label = "auth-mode"
                ) { signupMode ->
                    PremiumCard {
                        Column(
                            modifier = Modifier.padding(8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(22.dp)
                        ) {
                            Text(
                                text = if (signupMode) "Create Your Account" else "Welcome Back",
                                style = MaterialTheme.typography.headlineSmall,
                                color = Color.White,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = (-0.5).sp
                            )

                            LoginAdvancedRoleToggle(selectedRole) { selectedRole = it }

                            if (signupMode) {
                                PremiumOutlinedTextField(
                                    value = name,
                                    onValueChange = { name = it },
                                    label = "Your Full Name",
                                    leadingIcon = Icons.Default.Person
                                )
                            }

                            PremiumOutlinedTextField(
                                value = identifier,
                                onValueChange = { identifier = it },
                                label = "Student or Teacher ID",
                                leadingIcon = Icons.Default.Badge
                            )

                            PremiumOutlinedTextField(
                                value = password,
                                onValueChange = { password = it },
                                label = "Password",
                                leadingIcon = Icons.Default.Lock,
                                isPassword = true,
                                passwordVisible = passwordVisible,
                                onVisibilityToggle = { passwordVisible = !passwordVisible }
                            )

                            if (signupMode) {
                                PremiumOutlinedTextField(
                                    value = confirmPassword,
                                    onValueChange = { confirmPassword = it },
                                    label = "Confirm Password",
                                    leadingIcon = Icons.Default.Shield,
                                    isPassword = true,
                                    passwordVisible = confirmPasswordVisible,
                                    onVisibilityToggle = { confirmPasswordVisible = !confirmPasswordVisible }
                                )
                            }

                            GradientPrimaryButton(
                                text = if (signupMode) "REGISTER NOW" else "SIGN IN",
                                onClick = {
                                    if (identifier.isBlank() || password.isBlank()) {
                                        message = "Please enter your ID and password."
                                        return@GradientPrimaryButton
                                    }
                                    isLoading = true
                                    message = null
                                    scope.launch {
                                        try {
                                            if (signupMode) {
                                                val account = onSignup(UserAccount(name.trim(), identifier.trim().lowercase(), password, selectedRole))
                                                onSignupSuccess(account)
                                            } else {
                                                val account = onLogin(identifier.trim().lowercase(), password, selectedRole)
                                                if (account.role == UserRole.STUDENT) onStudentLogin(account) else onTeacherLogin(account)
                                            }
                                        } catch (e: Exception) {
                                            message = e.message ?: "Login failed. Please check your credentials."
                                        } finally {
                                            isLoading = false
                                        }
                                    }
                                },
                                loading = isLoading,
                                leadingIcon = if (signupMode) Icons.Default.PersonAdd else Icons.Default.Login
                            )

                            TextButton(onClick = { isSignupMode = !isSignupMode; message = null }) {
                                Text(
                                    text = if (signupMode) "Already have an account? Sign in here" else "New to CheatLock? Register here",
                                    color = CheatLockPurpleSoft,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }

                // Message Display
                (externalMessage ?: message)?.let {
                    PremiumCard(elevated = false) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val isError = it.contains("failed", true) || it.contains("error", true)
                            Icon(
                                if (isError) Icons.Default.Error else Icons.Default.CheckCircle,
                                null,
                                tint = if (isError) CheatLockDanger else CheatLockSuccess,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(Modifier.width(12.dp))
                            Text(
                                text = it.uppercase(),
                                color = if (isError) CheatLockDanger else CheatLockSuccess,
                                style = MaterialTheme.typography.labelSmall,
                                textAlign = TextAlign.Start,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginDecorativeNebula() {
    val transition = rememberInfiniteTransition(label = "login_nebula")
    val driftA by transition.animateFloat(
        initialValue = 0f, targetValue = 50f,
        animationSpec = infiniteRepeatable(tween(7000, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "driftA"
    )

    Canvas(modifier = Modifier.fillMaxSize()) {
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(CheatLockPurpleVibrant.copy(alpha = 0.05f), Color.Transparent),
                center = Offset(size.width * 0.8f, size.height * 0.1f + driftA.dp.toPx()),
                radius = size.width * 0.8f
            )
        )
    }
}

@Composable
private fun LoginAdvancedRoleToggle(selectedRole: UserRole, onRoleSelected: (UserRole) -> Unit) {
    val studentSelected = selectedRole == UserRole.STUDENT
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.03f))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(14.dp))
            .padding(4.dp)
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .clip(RoundedCornerShape(11.dp))
                .background(if (studentSelected) CheatLockPurpleVibrant else Color.Transparent)
                .clickable { onRoleSelected(UserRole.STUDENT) },
            contentAlignment = Alignment.Center
        ) {
            Text(
                "STUDENT",
                color = if (studentSelected) Color.White else CheatLockTextSecondaryDark,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 11.sp,
                letterSpacing = 1.sp
            )
        }
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .clip(RoundedCornerShape(11.dp))
                .background(if (!studentSelected) CheatLockPurpleVibrant else Color.Transparent)
                .clickable { onRoleSelected(UserRole.TEACHER) },
            contentAlignment = Alignment.Center
        ) {
            Text(
                "TEACHER",
                color = if (!studentSelected) Color.White else CheatLockTextSecondaryDark,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 11.sp,
                letterSpacing = 1.sp
            )
        }
    }
}
