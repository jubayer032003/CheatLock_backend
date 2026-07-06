plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

import java.util.Properties

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use(::load)
    }
}

// Default: deployed Render backend. Override in local.properties for local dev:
// cheatlock.apiBaseUrl=http://<YOUR_PC_IP>:3000/
val cheatLockApiBaseUrl =
    (localProperties.getProperty("cheatlock.apiBaseUrl")
        ?: providers.gradleProperty("cheatlock.apiBaseUrl").orNull
        ?: "https://cheatlock-backend.onrender.com/")
        .trim()
        .let { if (it.endsWith("/")) it else "$it/" }

android {
    namespace = "com.jubayer.cheatlock"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jubayer.cheatlock"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "CHEATLOCK_API_BASE_URL", "\"$cheatLockApiBaseUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false

            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.navigation:navigation-compose:2.8.0")
    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")

    implementation("com.google.mlkit:face-detection:16.1.6")
    implementation("com.google.mlkit:image-labeling:17.0.9")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("com.google.android.gms:play-services-mlkit-text-recognition:19.0.0")
    implementation("org.tensorflow:tensorflow-lite:2.16.1")
    implementation(libs.androidx.biometric)
    implementation(libs.zxing.core)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    // Unit test dependencies
    testImplementation("junit:junit:4.13.2")
    // Android instrumented test dependencies
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:core:1.5.0")
}
