package com.jubayer.cheatlock.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.label.ImageLabel
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.jubayer.cheatlock.proctoring.FaceEmbeddingModel
import java.io.ByteArrayOutputStream
import java.util.Locale
import java.util.concurrent.Executor

private const val TAG = "CameraPreview"

@SuppressLint("UnsafeOptInUsageError")
@Composable
fun CameraPreview(
    modifier: Modifier = Modifier,
    preferFastStartup: Boolean = false,
    onFaceStatusChanged: (FaceStatus) -> Unit,
    onPreviewSnapshot: (String) -> Unit = {},
    onFaceDescriptorChanged: (List<Double>) -> Unit = {},
    onPhoneDetected: () -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mainExecutor = ContextCompat.getMainExecutor(context)

    // Key the view to the lifecycleOwner and startup preference
    key(lifecycleOwner, preferFastStartup) {
        AndroidView(
            modifier = modifier,
            factory = { ctx ->
                val previewView = PreviewView(ctx).apply {
                    implementationMode = PreviewView.ImplementationMode.PERFORMANCE
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                }

                val faceEmbeddingModel = FaceEmbeddingModel(ctx.applicationContext)
                val mainHandler = Handler(Looper.getMainLooper())
                val cleanupCallbacks = mutableListOf<() -> Unit>()

                fun postStatus(status: FaceStatus) {
                    mainHandler.post { onFaceStatusChanged(status) }
                }

                postStatus(FaceStatus.CHECKING)

                previewView.setTag {
                    cleanupCallbacks.asReversed().forEach { cleanup ->
                        runCatching { cleanup() }
                    }
                }

                val snapshotTask = object : Runnable {
                    override fun run() {
                        val bitmap = previewView.bitmap
                        if (bitmap != null) {
                            Thread {
                                try {
                                    val dataUrl = bitmap.toSmallJpegDataUrl()
                                    val descriptor = faceEmbeddingModel.embed(bitmap)

                                    mainHandler.post {
                                        onPreviewSnapshot(dataUrl)
                                        descriptor?.let(onFaceDescriptorChanged)
                                    }
                                } catch (e: Exception) {
                                    Log.e(TAG, "Snapshot processing failed", e)
                                } finally {
                                    // Always recycle the bitmap, even on error paths
                                    runCatching { bitmap.recycle() }
                                }
                            }.start()
                        }
                        mainHandler.postDelayed(this, 2000)
                    }
                }
                mainHandler.postDelayed(snapshotTask, if (preferFastStartup) 400L else 1500L)
                cleanupCallbacks += {
                    mainHandler.removeCallbacksAndMessages(null)
                    faceEmbeddingModel.close()
                }

                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                cameraProviderFuture.addListener({
                    runCatching {
                        val cameraProvider = cameraProviderFuture.get()
                        
                        // Force unbind before re-binding to prevent hardware lock conflicts
                        cameraProvider.unbindAll()

                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        val detectorOptions = if (preferFastStartup) {
                            FaceDetectorOptions.Builder()
                                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                                .enableTracking()
                                .build()
                        } else {
                            FaceDetectorOptions.Builder()
                                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
                                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
                                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                                .enableTracking()
                                .build()
                        }

                        val detector = FaceDetection.getClient(detectorOptions)
                        val labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
                        cleanupCallbacks += {
                            detector.close()
                            labeler.close()
                        }

                        val analysisExecutor: Executor = ContextCompat.getMainExecutor(ctx)
                        val imageAnalysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()

                        var lastStatus: FaceStatus? = null
                        var lastPhoneAlertAt = 0L

                        imageAnalysis.setAnalyzer(analysisExecutor) { imageProxy ->
                            val mediaImage = imageProxy.image
                            if (mediaImage == null) {
                                imageProxy.close()
                                return@setAnalyzer
                            }

                            val image = InputImage.fromMediaImage(
                                mediaImage,
                                imageProxy.imageInfo.rotationDegrees
                            )

                            val faceTask = detector.process(image)
                                .addOnSuccessListener { faces ->
                                    val status = resolveFaceStatus(faces)
                                    if (status != lastStatus) {
                                        lastStatus = status
                                        postStatus(status)
                                    }
                                    if (!faceEmbeddingModel.isAvailable) {
                                        faces.firstOrNull()
                                            ?.toDescriptor(image.width, image.height)
                                            ?.let { descriptor ->
                                                mainHandler.post { onFaceDescriptorChanged(descriptor) }
                                            }
                                    }
                                }
                                .addOnFailureListener { error ->
                                    Log.e(TAG, "Face detection failed", error)
                                    postStatus(FaceStatus.NO_FACE)
                                }

                            val labelTask = labeler.process(image)
                                .addOnSuccessListener { labels ->
                                    if (labels.hasPhoneLabel()) {
                                        val now = System.currentTimeMillis()
                                        if (now - lastPhoneAlertAt > 8000) {
                                            lastPhoneAlertAt = now
                                            mainHandler.post { onPhoneDetected() }
                                        }
                                    }
                                }
                                .addOnFailureListener { error ->
                                    Log.e(TAG, "Labeling failed", error)
                                }

                            Tasks.whenAllComplete(faceTask, labelTask)
                                .addOnCompleteListener { imageProxy.close() }
                        }

                        val selectors = listOf(
                            CameraSelector.DEFAULT_FRONT_CAMERA,
                            CameraSelector.DEFAULT_BACK_CAMERA
                        )
                        
                        var bound = false
                        for (selector in selectors) {
                            if (bound) break
                            try {
                                cameraProvider.bindToLifecycle(
                                    lifecycleOwner,
                                    selector,
                                    preview,
                                    imageAnalysis
                                )
                                bound = true
                                Log.d(TAG, "Camera bound: $selector")
                            } catch (bindError: Exception) {
                                Log.w(TAG, "Could not bind $selector", bindError)
                            }
                        }
                        
                        if (!bound) {
                            postStatus(FaceStatus.NO_FACE)
                        } else {
                            cleanupCallbacks += { cameraProvider.unbindAll() }
                        }
                    }.onFailure { error ->
                        Log.e(TAG, "Camera setup failed", error)
                        postStatus(FaceStatus.NO_FACE)
                    }
                }, mainExecutor)

                previewView
            },
            update = { _ -> }, // Modifiers are handled by the shell
            onRelease = { previewView ->
                (previewView.getTag() as? (() -> Unit))?.invoke()
                previewView.setTag(null)
            }
        )
    }
}

private fun resolveFaceStatus(faces: List<Face>): FaceStatus {
    return when {
        faces.isEmpty() -> FaceStatus.NO_FACE
        faces.size > 1 -> FaceStatus.MULTIPLE_FACES
        else -> {
            val face = faces.first()
            when {
                face.headEulerAngleY > 28f || face.headEulerAngleY < -28f ||
                    face.headEulerAngleZ > 22f || face.headEulerAngleZ < -22f -> FaceStatus.LOOKING_AWAY
                else -> FaceStatus.FACE_FOUND
            }
        }
    }
}

private fun Bitmap.toSmallJpegDataUrl(): String {
    val maxSide = 320
    val largestSide = maxOf(width, height)
    val scaledBitmap = if (largestSide > maxSide) {
        val scale = maxSide.toFloat() / largestSide.toFloat()
        val targetWidth = (width * scale).toInt().coerceAtLeast(1)
        val targetHeight = (height * scale).toInt().coerceAtLeast(1)
        Bitmap.createScaledBitmap(this, targetWidth, targetHeight, true)
    } else {
        this
    }

    val output = ByteArrayOutputStream()
    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 32, output)
    
    // Step 4: Recycle intermediate scaled bitmap
    if (scaledBitmap != this) {
        scaledBitmap.recycle()
    }

    val base64 = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
    return "data:image/jpeg;base64,$base64"
}

private fun Face.toDescriptor(imageWidth: Int, imageHeight: Int): List<Double> {
    val safeWidth = imageWidth.coerceAtLeast(1).toDouble()
    val safeHeight = imageHeight.coerceAtLeast(1).toDouble()
    val box = boundingBox
    return listOf(
        box.centerX() / safeWidth,
        box.centerY() / safeHeight,
        box.width() / safeWidth,
        box.height() / safeHeight,
        headEulerAngleY / 60.0,
        headEulerAngleZ / 60.0,
        (leftEyeOpenProbability ?: 0.5f).toDouble(),
        (rightEyeOpenProbability ?: 0.5f).toDouble()
    )
}

private fun List<ImageLabel>.hasPhoneLabel(): Boolean {
    return any { label ->
        val text = label.text.lowercase(Locale.US)
        label.confidence >= 0.55f && (
            text.contains("phone") ||
                text.contains("mobile") ||
                text.contains("cellular") ||
                text.contains("telephone")
            )
    }
}
