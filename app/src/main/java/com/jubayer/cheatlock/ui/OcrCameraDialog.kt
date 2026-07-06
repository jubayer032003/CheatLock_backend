package com.jubayer.cheatlock.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import com.jubayer.cheatlock.ocr.ImageProcessor
import com.jubayer.cheatlock.ocr.OcrService
import com.jubayer.cheatlock.ui.theme.CheatLockNavyDeep
import com.jubayer.cheatlock.ui.theme.CheatLockPurpleVibrant
import com.jubayer.cheatlock.ui.theme.CheatLockSuccess
import com.jubayer.cheatlock.ui.theme.CheatLockWarning
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "OcrCameraDialog"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OcrCameraDialog(
    onDismiss: () -> Unit,
    onTextExtracted: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    var isProcessing by remember { mutableStateOf(false) }
    var processingMessage by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isTorchEnabled by remember { mutableStateOf(false) }

    // CameraX components
    val previewView = remember { PreviewView(context) }
    val imageCapture = remember {
        ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
            .build()
    }
    var cameraControl by remember { mutableStateOf<CameraControl?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }

    // Bind camera lifecycle
    LaunchedEffect(Unit) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider
                
                provider.unbindAll()

                val preview = Preview.Builder().build().apply {
                    setSurfaceProvider(previewView.surfaceProvider)
                }

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
                val camera = provider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageCapture
                )
                cameraControl = camera.cameraControl
            } catch (e: Exception) {
                Log.e(TAG, "Failed to bind camera", e)
                errorMessage = "Could not initialize camera: ${e.localizedMessage}"
            }
        }, ContextCompat.getMainExecutor(context))
    }

    // Dismiss camera provider on exit
    DisposableEffect(Unit) {
        onDispose {
            runCatching {
                cameraProvider?.unbindAll()
            }
        }
    }

    Dialog(
        onDismissRequest = { if (!isProcessing) onDismiss() },
        properties = DialogProperties(
            dismissOnBackPress = !isProcessing,
            dismissOnClickOutside = !isProcessing,
            usePlatformDefaultWidth = false
        )
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            // 1. Camera Preview
            AndroidView(
                factory = { previewView },
                modifier = Modifier.fillMaxSize()
            )

            // 2. Translucent Overlay with Cutout Window
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        // Apply a graphics layer to support BlendMode.Clear
                        alpha = 0.99f
                    }
            ) {
                val canvasWidth = size.width
                val canvasHeight = size.height

                // Draw dark mask over entire screen
                drawRect(
                    color = Color.Black.copy(alpha = 0.65f),
                    size = size
                )

                // Define crop/scan window bounds
                val boxWidth = canvasWidth * 0.88f
                val boxHeight = canvasHeight * 0.35f
                val left = (canvasWidth - boxWidth) / 2f
                val top = (canvasHeight - boxHeight) / 2f

                // Cut out scanning window
                drawRect(
                    color = Color.Transparent,
                    topLeft = Offset(left, top),
                    size = Size(boxWidth, boxHeight),
                    blendMode = BlendMode.Clear
                )

                // Draw premium border around scanning window
                drawRoundRect(
                    color = CheatLockPurpleVibrant,
                    topLeft = Offset(left, top),
                    size = Size(boxWidth, boxHeight),
                    cornerRadius = CornerRadius(12.dp.toPx(), 12.dp.toPx()),
                    style = Stroke(width = 3.dp.toPx())
                )
            }

            // 3. UI Controls and Overlay Contents
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Top Action Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { onDismiss() },
                        modifier = Modifier
                            .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.White
                        )
                    }

                    Text(
                        text = "SCAN QUESTION",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        letterSpacing = 1.5.sp
                    )

                    IconButton(
                        onClick = {
                            isTorchEnabled = !isTorchEnabled
                            cameraControl?.enableTorch(isTorchEnabled)
                        },
                        modifier = Modifier
                            .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                    ) {
                        Icon(
                            imageVector = if (isTorchEnabled) Icons.Default.FlashOn else Icons.Default.FlashOff,
                            contentDescription = "Toggle Torch",
                            tint = if (isTorchEnabled) Color.Yellow else Color.White
                        )
                    }
                }

                // Middle Scanning Guide Text
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(bottom = 60.dp)
                ) {
                    Text(
                        text = "Position printed/handwritten question inside frame",
                        color = Color.White.copy(alpha = 0.9f),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Hold steady to prevent blur",
                        color = Color.White.copy(alpha = 0.6f),
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center
                    )
                }

                // Bottom Action Button (Shutter)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .navigationBarsPadding()
                        .padding(bottom = 16.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .border(4.dp, Color.White, CircleShape)
                            .padding(6.dp)
                            .clip(CircleShape)
                            .background(if (isProcessing) Color.Gray else Color.White)
                            .clickable(enabled = !isProcessing) {
                                isProcessing = true
                                processingMessage = "Capturing image..."
                                errorMessage = null

                                imageCapture.takePicture(
                                    ContextCompat.getMainExecutor(context),
                                    object : ImageCapture.OnImageCapturedCallback() {
                                        override fun onCaptureSuccess(image: ImageProxy) {
                                            processingMessage = "Processing image..."
                                            scope.launch(Dispatchers.IO) {
                                                try {
                                                    // Convert ImageProxy to Bitmap
                                                    val rotation = image.imageInfo.rotationDegrees
                                                    val rawBitmap = image.toBitmap()
                                                    image.close()

                                                    // Apply OCR enhancements asynchronously
                                                    processingMessage = "Enhancing text..."
                                                    val processedBitmap = ImageProcessor.preprocess(rawBitmap, rotation)
                                                    
                                                    // Dispose rawBitmap if it changed during processing
                                                    if (processedBitmap != rawBitmap) {
                                                        rawBitmap.recycle()
                                                    }

                                                    processingMessage = "Recognizing text..."
                                                    val text = OcrService.recognizeText(processedBitmap)
                                                    processedBitmap.recycle() // release preprocessed bitmap memory

                                                    withContext(Dispatchers.Main) {
                                                        if (text.isBlank()) {
                                                            errorMessage = "No text detected. Please try again with clear text."
                                                            isProcessing = false
                                                        } else {
                                                            onTextExtracted(text)
                                                            onDismiss()
                                                        }
                                                    }
                                                } catch (e: Exception) {
                                                    Log.e(TAG, "OCR pipeline error", e)
                                                    withContext(Dispatchers.Main) {
                                                        errorMessage = "Processing failed: ${e.localizedMessage}"
                                                        isProcessing = false
                                                    }
                                                }
                                            }
                                        }

                                        override fun onError(exception: ImageCaptureException) {
                                            Log.e(TAG, "Capture failed", exception)
                                            errorMessage = "Capture failed: ${exception.localizedMessage}"
                                            isProcessing = false
                                        }
                                    }
                                )
                            }
                    )
                }
            }

            // 4. Async Loading Overlay
            AnimatedVisibility(
                visible = isProcessing,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.75f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator(
                            color = CheatLockPurpleVibrant,
                            strokeWidth = 4.dp
                        )
                        Text(
                            text = processingMessage,
                            color = Color.White,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // 5. Error Toast/Banner
            errorMessage?.let { error ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter)
                        .statusBarsPadding()
                        .padding(16.dp)
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = error,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Retry",
                                color = MaterialTheme.colorScheme.error,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.clickable { errorMessage = null }
                            )
                        }
                    }
                }
            }
        }
    }
}
