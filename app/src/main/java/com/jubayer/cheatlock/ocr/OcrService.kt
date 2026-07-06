package com.jubayer.cheatlock.ocr

import android.graphics.Bitmap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object OcrService {

    /**
     * Performs OCR asynchronously using Google ML Kit Text Recognition.
     * Runs in a background coroutine context to prevent UI freezing.
     */
    suspend fun recognizeText(bitmap: Bitmap): String = withContext(Dispatchers.Default) {
        // Initialize recognizer specifically for the task and close it after use
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val image = InputImage.fromBitmap(bitmap, 0)

        suspendCancellableCoroutine { continuation ->
            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    // Process visionText and build response string
                    val resultText = StringBuilder()
                    
                    // Prioritize line breaks, punctuation, multiple lines, paragraph formatting
                    for (block in visionText.textBlocks) {
                        for (line in block.lines) {
                            resultText.append(line.text).append("\n")
                        }
                        resultText.append("\n") // paragraph separation
                    }
                    
                    val trimmed = resultText.toString().trim()
                    continuation.resume(trimmed)
                }
                .addOnFailureListener { exception ->
                    continuation.resumeWithException(exception)
                }
                .addOnCompleteListener {
                    // Dispose resources
                    runCatching { recognizer.close() }
                }
        }
    }
}
