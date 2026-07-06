package com.jubayer.cheatlock.ui

import android.annotation.SuppressLint
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.atomic.AtomicBoolean

private const val QR_SCANNER_TAG = "QrCodeScannerView"

@SuppressLint("UnsafeOptInUsageError")
@Composable
fun QrCodeScannerView(
    modifier: Modifier = Modifier,
    onCodeScanned: (String) -> Unit,
    onScannerError: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mainExecutor = ContextCompat.getMainExecutor(context)

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            val previewView = PreviewView(ctx).apply {
                implementationMode = PreviewView.ImplementationMode.PERFORMANCE
                scaleType = PreviewView.ScaleType.FILL_CENTER
            }

            val scanner = BarcodeScanning.getClient()
            val didEmitCode = AtomicBoolean(false)
            val cleanupCallbacks = mutableListOf<() -> Unit>()

            previewView.setTag {
                cleanupCallbacks.asReversed().forEach { cleanup ->
                    runCatching { cleanup() }
                }
            }

            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
            cameraProviderFuture.addListener({
                runCatching {
                    val cameraProvider = cameraProviderFuture.get()
                    cleanupCallbacks += {
                        runCatching { cameraProvider.unbindAll() }
                        runCatching { scanner.close() }
                    }

                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }

                    val analyzer = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()

                    analyzer.setAnalyzer(mainExecutor) { imageProxy ->
                        val mediaImage = imageProxy.image
                        if (mediaImage == null) {
                            imageProxy.close()
                            return@setAnalyzer
                        }

                        if (didEmitCode.get()) {
                            imageProxy.close()
                            return@setAnalyzer
                        }

                        val image = InputImage.fromMediaImage(
                            mediaImage,
                            imageProxy.imageInfo.rotationDegrees
                        )

                        scanner.process(image)
                            .addOnSuccessListener { barcodes ->
                                if (didEmitCode.get()) return@addOnSuccessListener
                                val value = barcodes.firstReadableValue()
                                if (!value.isNullOrBlank() && didEmitCode.compareAndSet(false, true)) {
                                    onCodeScanned(value)
                                }
                            }
                            .addOnFailureListener { error ->
                                Log.w(QR_SCANNER_TAG, "QR scan failed", error)
                            }
                            .addOnCompleteListener { imageProxy.close() }
                    }

                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analyzer
                    )
                }.onFailure { error ->
                    Log.e(QR_SCANNER_TAG, "Could not start scanner", error)
                    onScannerError("Unable to start camera scanner.")
                }
            }, mainExecutor)

            previewView
        },
        onRelease = { previewView ->
            (previewView.getTag() as? (() -> Unit))?.invoke()
            previewView.setTag(null)
        }
    )
}

private fun List<Barcode>.firstReadableValue(): String? {
    return firstNotNullOfOrNull { barcode ->
        barcode.rawValue ?: barcode.displayValue
    }
}
