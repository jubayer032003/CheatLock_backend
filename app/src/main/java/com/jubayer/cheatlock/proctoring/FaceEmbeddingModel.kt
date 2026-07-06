package com.jubayer.cheatlock.proctoring

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.sqrt

class FaceEmbeddingModel(context: Context) {
    private var interpreter: Interpreter? = runCatching {
        Interpreter(loadModel(context, MODEL_ASSET))
    }.onFailure {
        Log.w("FaceEmbeddingModel", "Face embedding model not loaded: ${it.message}")
    }.getOrNull()

    @Volatile
    private var closed = false

    /**
     * Pre-allocated direct buffer for model input. 
     * Using allocateDirect prevents JVM heap churn and ensures compatibility with native TFLite.
     */
    private val inputBuffer = ByteBuffer
        .allocateDirect(1 * INPUT_SIZE * INPUT_SIZE * 3 * FLOAT_BYTES)
        .order(ByteOrder.nativeOrder())

    val isAvailable: Boolean
        get() = !closed && interpreter != null

    fun embed(bitmap: Bitmap): List<Double>? = synchronized(this) {
        if (closed) return null
        val model = interpreter ?: return null
        
        // Step 1: Pre-process image with explicit memory management
        val cropped = bitmap.centerCropSquare()
        val scaled = Bitmap.createScaledBitmap(cropped, INPUT_SIZE, INPUT_SIZE, true)
        
        // If centerCropSquare created a new bitmap (different from original), recycle the intermediate
        if (cropped != bitmap) cropped.recycle()

        // Step 2: Load into reusable input buffer
        val input = scaled.toModelInput()
        
        // After converting to buffer, the scaled bitmap is no longer needed
        scaled.recycle()

        val output = Array(1) { FloatArray(EMBEDDING_SIZE) }

        return runCatching {
            model.run(input, output)
            output[0].normalize().map { it.toDouble() }
        }.onFailure {
            Log.w("FaceEmbeddingModel", "Face embedding failed: ${it.message}")
        }.getOrNull()
    }

    fun close() = synchronized(this) {
        if (closed) return
        closed = true
        runCatching { interpreter?.close() }
        interpreter = null
    }

    private fun Bitmap.centerCropSquare(): Bitmap {
        val size = minOf(width, height)
        val x = ((width - size) / 2).coerceAtLeast(0)
        val y = ((height - size) / 2).coerceAtLeast(0)
        
        // If the bitmap is already square, return as is
        if (size == width && size == height) return this
        
        return Bitmap.createBitmap(this, x, y, size, size)
    }

    private fun Bitmap.toModelInput(): ByteBuffer {
        inputBuffer.rewind() // Clear the reusable buffer for the new frame

        val pixels = IntArray(INPUT_SIZE * INPUT_SIZE)
        getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE)
        pixels.forEach { pixel ->
            val red = (pixel shr 16 and 0xFF)
            val green = (pixel shr 8 and 0xFF)
            val blue = (pixel and 0xFF)
            inputBuffer.putFloat((red - 127.5f) / 128f)
            inputBuffer.putFloat((green - 127.5f) / 128f)
            inputBuffer.putFloat((blue - 127.5f) / 128f)
        }
        inputBuffer.rewind()
        return inputBuffer
    }

    private fun FloatArray.normalize(): FloatArray {
        var sum = 0f
        forEach { value -> sum += value * value }
        val norm = sqrt(sum).coerceAtLeast(0.0001f)
        return FloatArray(size) { index -> this[index] / norm }
    }

    private fun loadModel(context: Context, assetName: String): MappedByteBuffer {
        val descriptor = context.assets.openFd(assetName)
        return descriptor.use { fd ->
            FileInputStream(fd.fileDescriptor).use { input ->
                input.channel.map(
                    FileChannel.MapMode.READ_ONLY,
                    fd.startOffset,
                    fd.declaredLength
                )
            }
        }
    }

    private companion object {
        const val MODEL_ASSET = "mobile_face_net.tflite"
        const val INPUT_SIZE = 112
        const val EMBEDDING_SIZE = 192
        const val FLOAT_BYTES = 4
    }
}
