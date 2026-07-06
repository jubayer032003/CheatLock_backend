package com.jubayer.cheatlock.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jubayer.cheatlock.ui.theme.*
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToSignup: () -> Unit,
    onPurchasePlan: (String) -> Unit
) {
    val scrollState = rememberScrollState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    // Section offsets for navigation
    var featuresOffset by remember { mutableStateOf(0f) }
    var pricingOffset by remember { mutableStateOf(0f) }
    var howItWorksOffset by remember { mutableStateOf(0f) }
    var faqOffset by remember { mutableStateOf(0f) }
    var footerOffset by remember { mutableStateOf(0f) }

    fun scrollTo(offset: Float) {
        scope.launch {
            drawerState.close()
            scrollState.animateScrollTo(offset.roundToInt())
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = CheatLockNavyDeep,
                drawerShape = RoundedCornerShape(topEnd = 24.dp, bottomEnd = 24.dp)
            ) {
                HomeDrawerContent(
                    onClose = { scope.launch { drawerState.close() } },
                    onLogin = onNavigateToLogin,
                    onSignup = onNavigateToSignup,
                    onScrollToFeatures = { scrollTo(featuresOffset) },
                    onScrollToPricing = { scrollTo(pricingOffset) },
                    onScrollToHowItWorks = { scrollTo(howItWorksOffset) },
                    onScrollToFaq = { scrollTo(faqOffset) },
                    onScrollToContact = { scrollTo(footerOffset) }
                )
            }
        }
    ) {
        Scaffold(
            topBar = {
                HomeTopBar(
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    onLogin = onNavigateToLogin,
                    onSignup = onNavigateToSignup
                )
            },
            containerColor = Color.Transparent
        ) { innerPadding ->
            PremiumScreen(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .verticalScroll(scrollState)
                        .padding(bottom = 40.dp),
                    verticalArrangement = Arrangement.spacedBy(64.dp)
                ) {
                    HeroSection(onGetStarted = onNavigateToSignup)
                    
                    Box(modifier = Modifier.onGloballyPositioned { featuresOffset = it.positionInParent().y }) {
                        FeaturesSection()
                    }
                    
                    Box(modifier = Modifier.onGloballyPositioned { howItWorksOffset = it.positionInParent().y }) {
                        HowItWorksSection()
                    }
                    
                    Box(modifier = Modifier.onGloballyPositioned { pricingOffset = it.positionInParent().y }) {
                        PricingSection(onPurchase = onPurchasePlan)
                    }
                    
                    TestimonialsSection()
                    
                    Box(modifier = Modifier.onGloballyPositioned { faqOffset = it.positionInParent().y }) {
                        FaqSection()
                    }

                    Box(modifier = Modifier.onGloballyPositioned { footerOffset = it.positionInParent().y }) {
                        FooterSection()
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeTopBar(
    onOpenDrawer: () -> Unit,
    onLogin: () -> Unit,
    onSignup: () -> Unit
) {
    CenterAlignedTopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(id = com.jubayer.cheatlock.R.drawable.ic_logo_emblem),
                    contentDescription = null,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "CheatLock",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onOpenDrawer) {
                Icon(Icons.Default.Menu, "Menu")
            }
        },
        actions = {
            TextButton(onClick = onLogin) {
                Text("LOGIN", fontWeight = FontWeight.Bold, color = CheatLockPurpleSoft)
            }
        },
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = Color.Transparent,
            scrolledContainerColor = Color.Transparent,
            navigationIconContentColor = Color.White,
            titleContentColor = Color.White,
            actionIconContentColor = Color.White
        )
    )
}

@Composable
private fun HeroSection(onGetStarted: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Animated Branding from Login
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(140.dp)) {
            val transition = rememberInfiniteTransition(label = "rings")
            val rotation by transition.animateFloat(
                initialValue = 0f,
                targetValue = 360f,
                animationSpec = infiniteRepeatable(tween(5000, easing = LinearEasing)),
                label = "rotation"
            )
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawCircle(
                    color = CheatLockPurpleVibrant.copy(alpha = 0.12f),
                    style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 12f), 0f))
                )
                rotate(rotation) {
                    drawArc(
                        color = CheatLockPurpleVibrant,
                        startAngle = 0f,
                        sweepAngle = 120f,
                        useCenter = false,
                        style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                    )
                    drawArc(
                        color = CheatLockPurpleSoft.copy(alpha = 0.5f),
                        startAngle = 200f,
                        sweepAngle = 60f,
                        useCenter = false,
                        style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
                    )
                }
            }
            Image(
                painter = painterResource(id = com.jubayer.cheatlock.R.drawable.ic_logo_emblem),
                contentDescription = null,
                modifier = Modifier.size(80.dp)
            )
        }

        SparklingBrandText(
            text = "CheatLock",
            style = MaterialTheme.typography.displayMedium,
            modifier = Modifier.padding(top = 16.dp)
        )

        Text(
            text = "AI-Powered Exam Security Platform",
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Text(
            text = "Redefining academic integrity with advanced face detection, real-time monitoring, and intelligent proctoring solutions.",
            style = MaterialTheme.typography.bodyLarge,
            color = CheatLockTextSecondaryDark,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Column(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            GradientPrimaryButton(
                text = "GET STARTED",
                onClick = onGetStarted,
                modifier = Modifier.fillMaxWidth().height(58.dp),
                leadingIcon = Icons.Default.RocketLaunch
            )
            
            OutlinedButton(
                onClick = { /* Watch Video */ },
                modifier = Modifier.fillMaxWidth().height(58.dp),
                shape = MaterialTheme.shapes.medium,
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = Color.White
                )
            ) {
                Icon(
                    imageVector = Icons.Default.PlayCircle, 
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = CheatLockPurpleSoft
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    "WATCH VIDEO", 
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}

@Composable
private fun FeaturesSection() {
    Column(
        modifier = Modifier.padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(32.dp)
    ) {
        SectionHeader(
            title = "Powerful Features",
            subtitle = "Everything you need to ensure secure assessments"
        )

        val features = listOf(
            FeatureData("AI Proctoring", "Automated behavior analysis and threat detection.", Icons.Default.AutoGraph),
            FeatureData("Face Detection", "Continuous biometric verification of students.", Icons.Default.Face),
            FeatureData("Anti-Cheating", "Browser lock and app-switch monitoring.", Icons.Default.Security),
            FeatureData("Real-Time Alerts", "Instant signals for proctors and teachers.", Icons.Default.NotificationsActive),
            FeatureData("Analytics", "Detailed integrity reports and risk scores.", Icons.Default.Assessment),
            FeatureData("Multi-Platform", "Secure mobile and web dashboard access.", Icons.Default.Devices)
        )

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            features.chunked(2).forEach { rowFeatures ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    rowFeatures.forEach { feature ->
                        FeatureCard(feature, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun HowItWorksSection() {
    Column(
        modifier = Modifier.padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(32.dp)
    ) {
        SectionHeader(
            title = "How It Works",
            subtitle = "Deployment in four simple steps"
        )

        val steps = listOf(
            StepData("01", "Create Account", "Register as a teacher or institution to begin."),
            StepData("02", "Configure Exam", "Build questions and set proctoring strictness."),
            StepData("03", "Live Monitoring", "Observe student streams and AI security signals."),
            StepData("04", "Review Reports", "Analyze detailed logs and assign final grades.")
        )

        steps.forEach { step ->
            HowItWorksRow(step)
        }
    }
}

@Composable
private fun PricingSection(onPurchase: (String) -> Unit) {
    var isYearly by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(32.dp)
    ) {
        SectionHeader(
            title = "Simple Pricing",
            subtitle = "Choose the plan that fits your academic needs"
        )

        // Billing Toggle
        Row(
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .clip(CircleShape)
                .background(CheatLockNavyRich)
                .padding(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val toggleModifier = Modifier
                .clip(CircleShape)
                .clickable { isYearly = !isYearly }
                .padding(horizontal = 20.dp, vertical = 8.dp)

            Text(
                "Monthly",
                modifier = toggleModifier.background(if (!isYearly) CheatLockPurpleVibrant else Color.Transparent),
                color = if (!isYearly) Color.White else CheatLockTextSecondaryDark,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
            Text(
                "Yearly",
                modifier = toggleModifier.background(if (isYearly) CheatLockPurpleVibrant else Color.Transparent),
                color = if (isYearly) Color.White else CheatLockTextSecondaryDark,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
        }

        val plans = listOf(
            PlanData("Free", "0", "Basic access for individuals.", listOf("3 Exams/Mo", "Basic Proctoring", "5 Students")),
            PlanData("Basic", if(isYearly) "19" else "29", "Standard security for classes.", listOf("Unlimited Exams", "Face Detection", "30 Students")),
            PlanData("Pro", if(isYearly) "49" else "69", "Advanced proctoring for departments.", listOf("AI Analytics", "Live Recording", "100 Students"), isPopular = true),
            PlanData("Enterprise", "Custom", "Full-scale institutional integrity.", listOf("Dedicated Server", "API Access", "SSO Login"))
        )

        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
            plans.forEach { plan ->
                PricingCard(plan, isYearly, onPurchase = { onPurchase(plan.name) })
            }
        }
    }
}

@Composable
private fun TestimonialsSection() {
    Column(
        modifier = Modifier.padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(32.dp)
    ) {
        SectionHeader(
            title = "Testimonials",
            subtitle = "Trusted by educators worldwide"
        )

        val reviews = listOf(
            ReviewData("Dr. Sarah Jenkins", "University of Tech", "CheatLock has completely transformed how we conduct remote assessments. The AI is remarkably accurate."),
            ReviewData("James Wilson", "Online Academy", "The teacher dashboard is intuitive and powerful. Real-time alerts are a game changer.")
        )

        reviews.forEach { review ->
            PremiumCard {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(40.dp).clip(CircleShape).background(CheatLockPurpleVibrant), contentAlignment = Alignment.Center) {
                            Text(review.name.take(1), color = Color.White, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(review.name, fontWeight = FontWeight.Bold, color = Color.White)
                            Text(review.org, style = MaterialTheme.typography.labelSmall, color = CheatLockTextSecondaryDark)
                        }
                    }
                    Text("“${review.text}”", style = MaterialTheme.typography.bodyMedium, color = CheatLockTextSecondaryDark)
                }
            }
        }
    }
}

@Composable
private fun FaqSection() {
    Column(
        modifier = Modifier.padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        SectionHeader(title = "FAQ", subtitle = "Common questions about our platform")

        val faqs = listOf(
            "How does AI proctoring work?" to "Our AI monitors student behavior, eye movement, and environment noises to detect potential integrity breaches automatically.",
            "Can students use it on any device?" to "Yes, CheatLock is optimized for both desktop browsers and mobile devices through our cross-platform apps.",
            "Is the data encrypted?" to "Security is our priority. All student data, video streams, and exam content are encrypted using enterprise-grade protocols."
        )

        faqs.forEach { (q, a) ->
            var expanded by remember { mutableStateOf(false) }
            PremiumCard {
                Column(
                    modifier = Modifier.clickable { expanded = !expanded },
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(q, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.weight(1f))
                        Icon(
                            if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            null,
                            tint = CheatLockPurpleSoft
                        )
                    }
                    AnimatedVisibility(visible = expanded) {
                        Text(a, style = MaterialTheme.typography.bodySmall, color = CheatLockTextSecondaryDark)
                    }
                }
            }
        }
    }
}

@Composable
private fun FooterSection() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.25f))
            .padding(vertical = 40.dp, horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                painter = painterResource(id = com.jubayer.cheatlock.R.drawable.ic_logo_emblem),
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                alpha = 0.6f
            )
            Spacer(Modifier.width(12.dp))
            Text(
                "CheatLock Security",
                style = MaterialTheme.typography.titleSmall,
                color = Color.White.copy(alpha = 0.7f),
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            Text("About", color = CheatLockTextSecondaryDark, style = MaterialTheme.typography.labelSmall)
            Text("Privacy", color = CheatLockTextSecondaryDark, style = MaterialTheme.typography.labelSmall)
            Text("Terms", color = CheatLockTextSecondaryDark, style = MaterialTheme.typography.labelSmall)
            Text("Contact", color = CheatLockTextSecondaryDark, style = MaterialTheme.typography.labelSmall)
        }

        Divider(
            modifier = Modifier.width(40.dp),
            thickness = 1.dp,
            color = Color.White.copy(alpha = 0.1f)
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                "© 2026 CheatLock Security. All rights reserved.",
                style = MaterialTheme.typography.labelSmall,
                color = CheatLockTextSecondaryDark,
                textAlign = TextAlign.Center
            )
            Text(
                "Developed by Jubayer Rahman Chowdhury (Team NextZen)",
                style = MaterialTheme.typography.labelSmall,
                color = CheatLockPurpleSoft.copy(alpha = 0.7f),
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun FeatureCard(data: FeatureData, modifier: Modifier = Modifier) {
    PremiumCard(modifier = modifier, elevated = false) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(CheatLockPurpleVibrant.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(data.icon, null, tint = CheatLockPurpleVibrant, modifier = Modifier.size(20.dp))
            }
            Text(data.title, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
            Text(data.desc, style = MaterialTheme.typography.bodySmall, color = CheatLockTextSecondaryDark, lineHeight = 18.sp)
        }
    }
}

@Composable
private fun HowItWorksRow(data: StepData) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Text(
            text = data.no,
            style = MaterialTheme.typography.displaySmall,
            color = CheatLockPurpleVibrant.copy(alpha = 0.3f),
            fontWeight = FontWeight.Black
        )
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(data.title, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 18.sp)
            Text(data.desc, style = MaterialTheme.typography.bodyMedium, color = CheatLockTextSecondaryDark)
        }
    }
}

@Composable
private fun PricingCard(data: PlanData, isYearly: Boolean, onPurchase: () -> Unit) {
    PremiumCard(
        modifier = if (data.isPopular) Modifier.border(1.dp, CheatLockPurpleVibrant, MaterialTheme.shapes.large) else Modifier
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (data.isPopular) {
                StatusPill(label = "MOST POPULAR", statusColor = CheatLockPurpleVibrant)
            }
            Text(data.name, fontWeight = FontWeight.Black, color = Color.White, fontSize = 20.sp)
            Row(verticalAlignment = Alignment.Bottom) {
                Text("$", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
                Text(data.price, color = Color.White, style = MaterialTheme.typography.displayMedium, fontWeight = FontWeight.Black)
                Text(if (data.price == "Custom") "" else if (isYearly) "/yr" else "/mo", color = CheatLockTextSecondaryDark, modifier = Modifier.padding(bottom = 8.dp, start = 4.dp))
            }
            Text(data.desc, style = MaterialTheme.typography.bodySmall, color = CheatLockTextSecondaryDark)
            
            Divider(color = Color.White.copy(alpha = 0.05f))
            
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                data.features.forEach { feat ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Check, null, tint = CheatLockSuccess, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(feat, style = MaterialTheme.typography.bodySmall, color = Color.White)
                    }
                }
            }
            
            GradientPrimaryButton(
                text = if (data.name == "Free") "GET STARTED" else "BUY NOW",
                onClick = onPurchase
            )
        }
    }
}

@Composable
private fun HomeDrawerContent(
    onClose: () -> Unit,
    onLogin: () -> Unit,
    onSignup: () -> Unit,
    onScrollToFeatures: () -> Unit,
    onScrollToPricing: () -> Unit,
    onScrollToHowItWorks: () -> Unit,
    onScrollToFaq: () -> Unit,
    onScrollToContact: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxHeight()
            .width(300.dp)
            .background(CheatLockNavyDeep)
    ) {
        // 1. Cinematic Background Nebula
        val transition = rememberInfiniteTransition(label = "nebula")
        val driftA by transition.animateFloat(
            initialValue = 0f, targetValue = 40f,
            animationSpec = infiniteRepeatable(tween(8000, easing = FastOutSlowInEasing), RepeatMode.Reverse),
            label = "driftA"
        )
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(CheatLockPurpleVibrant.copy(alpha = 0.08f), Color.Transparent),
                    center = Offset(size.width * 0.15f + driftA.dp.toPx(), size.height * 0.2f),
                    radius = size.width * 1.2f
                )
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
            // 2. Premium Header with Animated Logo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(48.dp)) {
                        val rotation by transition.animateFloat(
                            initialValue = 0f, targetValue = 360f,
                            animationSpec = infiniteRepeatable(tween(5000, easing = LinearEasing)),
                            label = "rotation"
                        )
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            drawCircle(
                                color = CheatLockPurpleVibrant.copy(alpha = 0.15f),
                                style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f))
                            )
                            rotate(rotation) {
                                drawArc(
                                    color = CheatLockPurpleVibrant,
                                    startAngle = 0f, sweepAngle = 120f, useCenter = false,
                                    style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
                                )
                            }
                        }
                        Image(
                            painter = painterResource(id = com.jubayer.cheatlock.R.drawable.ic_logo_emblem),
                            contentDescription = null,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                    Spacer(Modifier.width(16.dp))
                    Text(
                        "CheatLock",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp
                    )
                }
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, null, tint = CheatLockTextSecondaryDark)
                }
            }

            // 3. Glassmorphic Navigation Links
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DrawerLink("Features", Icons.Default.AutoGraph) { onScrollToFeatures() }
                DrawerLink("Pricing", Icons.Default.Payments) { onScrollToPricing() }
                DrawerLink("How It Works", Icons.Default.Info) { onScrollToHowItWorks() }
                DrawerLink("FAQ", Icons.Default.QuestionAnswer) { onScrollToFaq() }
                DrawerLink("Contact", Icons.Default.Email) { onScrollToContact() }
            }

            Spacer(Modifier.weight(1f))

            // 4. Premium Security Status Footer
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.04f))
                    .border(1.dp, CheatLockGlassBorder, RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val pulseAlpha by transition.animateFloat(
                        initialValue = 0.4f, targetValue = 1f,
                        animationSpec = infiniteRepeatable(tween(1500, easing = FastOutSlowInEasing), RepeatMode.Reverse),
                        label = "pulseAlpha"
                    )
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(CheatLockSuccess.copy(alpha = pulseAlpha))
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "SYSTEM SECURED",
                        style = MaterialTheme.typography.labelSmall,
                        color = CheatLockTextSecondaryDark,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }
            }

            // 5. Action Buttons
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = onLogin,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = MaterialTheme.shapes.medium,
                    border = BorderStroke(1.dp, CheatLockPurpleSoft.copy(alpha = 0.4f))
                ) {
                    Text("LOGIN", fontWeight = FontWeight.Bold, color = CheatLockPurpleSoft)
                }
                GradientPrimaryButton(text = "SIGN UP", onClick = onSignup)
            }
        }
    }
}

@Composable
private fun DrawerLink(text: String, icon: ImageVector, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                icon, null,
                tint = CheatLockPurpleSoft,
                modifier = Modifier.size(22.dp)
            )
            Spacer(Modifier.width(16.dp))
            Text(
                text,
                color = Color.White,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

private data class FeatureData(val title: String, val desc: String, val icon: ImageVector)
private data class StepData(val no: String, val title: String, val desc: String)
private data class PlanData(val name: String, val price: String, val desc: String, val features: List<String>, val isPopular: Boolean = false)
private data class ReviewData(val name: String, val org: String, val text: String)
