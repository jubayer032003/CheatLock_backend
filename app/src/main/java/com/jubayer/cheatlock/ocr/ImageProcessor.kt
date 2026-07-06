package com.jubayer.cheatlock.ocr

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.util.Log

object ImageProcessor {
    private const val TAG = "ImageProcessor"

    /**
     * Complete high-accuracy image preprocessing pipeline:
     * 1. Rotate upright (based on Exif/CameraX rotation)
     * 2. Crop to the exact coordinates of the UI scanning cutout box
     * 3. Scale to an optimal resolution (max side 1800px) to preserve fine handwriting features
     * 4. Convert to Grayscale
     * 5. Apply Division Normalization to eliminate uneven lighting/shadows while keeping anti-aliasing
     * 6. Apply a gentle sharpening filter to boost edge recognition
     */
    fun preprocess(src: Bitmap, rotationDegrees: Int): Bitmap {
        var current = src

        // 1. Auto-rotation
        if (rotationDegrees != 0) {
            val rotated = rotate(current, rotationDegrees.toFloat())
            if (rotated != current) {
                current = rotated
            }
        }

        // 2. Crop to the highlighted UI scanning cutout box (Ratios: left = 6%, top = 32.5%, width = 88%, height = 35%)
        val cropped = cropToScanBox(current)
        if (cropped != current) {
            if (current != src) {
                current.recycle()
            }
            current = cropped
        }

        // 3. Scale to optimal OCR resolution (max side 1800px) to ensure super accuracy
        val scaled = resizeToOptimal(current, 1800)
        if (scaled != current) {
            if (current != src) {
                current.recycle()
            }
            current = scaled
        }

        // 4. Convert to Grayscale
        val grayscale = toGrayscale(current)
        if (current != src && current != scaled) {
            current.recycle()
        }
        current = grayscale

        // 5. Apply Division Normalization (shadow removal while preserving ink gradients)
        val normalized = divisionNormalization(current, windowSize = 60)
        if (current != src) {
            current.recycle()
        }
        current = normalized

        // 6. Apply Gentle Sharpening (enhances handwriting stroke clarity)
        val sharpened = gentleSharpen(current)
        if (current != src) {
            current.recycle()
        }
        current = sharpened

        return current
    }

    /**
     * Rotates a bitmap by the specified degrees.
     */
    private fun rotate(bitmap: Bitmap, degrees: Float): Bitmap {
        return try {
            val matrix = Matrix().apply { postRotate(degrees) }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to rotate bitmap", e)
            bitmap
        }
    }

    /**
     * Crops the rotated bitmap to match the visual scanner cutout overlay.
     * Overlay Box Ratios: Left = 6%, Top = 32.5%, Width = 88%, Height = 35%
     */
    private fun cropToScanBox(src: Bitmap): Bitmap {
        val width = src.width
        val height = src.height

        val cropLeft = (width * 0.06f).toInt().coerceIn(0, width - 1)
        val cropTop = (height * 0.325f).toInt().coerceIn(0, height - 1)
        val cropWidth = (width * 0.88f).toInt().coerceAtMost(width - cropLeft)
        val cropHeight = (height * 0.35f).toInt().coerceAtMost(height - cropTop)

        return if (cropWidth > 40 && cropHeight > 40) {
            try {
                Bitmap.createBitmap(src, cropLeft, cropTop, cropWidth, cropHeight)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to crop to scan box ratio", e)
                src
            }
        } else {
            src
        }
    }

    /**
     * Resizes a bitmap so that its longest side is at most maxDimension, preserving aspect ratio.
     */
    private fun resizeToOptimal(src: Bitmap, maxDimension: Int): Bitmap {
        val width = src.width
        val height = src.height
        val maxSide = maxOf(width, height)
        if (maxSide <= maxDimension) return src

        val scale = maxDimension.toFloat() / maxSide.toFloat()
        val targetW = (width * scale).toInt().coerceAtLeast(1)
        val targetH = (height * scale).toInt().coerceAtLeast(1)

        return try {
            Bitmap.createScaledBitmap(src, targetW, targetH, true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to scale bitmap to optimal size", e)
            src
        }
    }

    /**
     * Converts a bitmap to grayscale using hardware-accelerated Canvas operations.
     */
    private fun toGrayscale(src: Bitmap): Bitmap {
        val width = src.width
        val height = src.height
        val bmpGrayscale = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmpGrayscale)
        val paint = Paint()
        val colorMatrix = ColorMatrix().apply { setSaturation(0f) }
        paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
        canvas.drawBitmap(src, 0f, 0f, paint)
        return bmpGrayscale
    }

    /**
     * Division Normalization filter.
     * Computes the local background intensity using an O(1) integral image window average,
     * and divides each pixel by this background average. This neutralizes uneven shadows/lighting
     * while retaining smooth anti-aliased edges for print and handwritten text.
     */
    private fun divisionNormalization(src: Bitmap, windowSize: Int): Bitmap {
        val width = src.width
        val height = src.height
        val pixels = IntArray(width * height)
        src.getPixels(pixels, 0, width, 0, 0, width, height)

        val integral = LongArray(width * height)
        var sum: Long
        for (y in 0 until height) {
            sum = 0
            for (x in 0 until width) {
                val index = y * width + x
                val gray = pixels[index] and 0xff
                sum += gray
                if (y == 0) {
                    integral[index] = sum
                } else {
                    integral[index] = integral[(y - 1) * width + x] + sum
                }
            }
        }

        val resultPixels = IntArray(width * height)
        val halfWindow = windowSize / 2

        for (y in 0 until height) {
            for (x in 0 until width) {
                val index = y * width + x
                val gray = pixels[index] and 0xff

                val x1 = maxOf(0, x - halfWindow)
                val x2 = minOf(width - 1, x + halfWindow)
                val y1 = maxOf(0, y - halfWindow)
                val y2 = minOf(height - 1, y + halfWindow)

                val count = (x2 - x1 + 1) * (y2 - y1 + 1)

                val iX2Y2 = integral[y2 * width + x2]
                val iX1Minus1Y2 = if (x1 > 0) integral[y2 * width + (x1 - 1)] else 0L
                val iX2Y1Minus1 = if (y1 > 0) integral[(y1 - 1) * width + x2] else 0L
                val iX1Minus1Y1Minus1 = if (x1 > 0 && y1 > 0) integral[(y1 - 1) * width + (x1 - 1)] else 0L

                val localSum = iX2Y2 - iX1Minus1Y2 - iX2Y1Minus1 + iX1Minus1Y1Minus1
                val localAvg = localSum / count

                val normalized = if (localAvg > 0) {
                    val value = (gray * 255) / localAvg
                    value.coerceIn(0, 255).toInt()
                } else {
                    255
                }

                resultPixels[index] = 0xFF000000.toInt() or (normalized shl 16) or (normalized shl 8) or normalized
            }
        }

        val outBmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        outBmp.setPixels(resultPixels, 0, width, 0, 0, width, height)
        return outBmp
    }

    /**
     * Applies a gentle sharpening convolution filter to boost character edge definition
     * without introducing high-frequency background noise.
     */
    private fun gentleSharpen(src: Bitmap): Bitmap {
        val width = src.width
        val height = src.height
        val pixels = IntArray(width * height)
        src.getPixels(pixels, 0, width, 0, 0, width, height)
        val outPixels = IntArray(width * height)

        // Gentle Sharpening Kernel:
        // [ 0,  -0.5,  0]
        // [-0.5,  3.0, -0.5]
        // [ 0,  -0.5,  0]
        // Integer Equivalent: (6 * Center - (Sum of Neighbors)) / 2
        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = y * width + x
                if (x == 0 || x == width - 1 || y == 0 || y == height - 1) {
                    outPixels[idx] = pixels[idx]
                    continue
                }

                val c = pixels[idx]
                val l = pixels[idx - 1]
                val r = pixels[idx + 1]
                val t = pixels[idx - width]
                val b = pixels[idx + width]

                val cVal = c and 0xff
                val lVal = l and 0xff
                val rVal = r and 0xff
                val tVal = t and 0xff
                val bVal = b and 0xff

                val sumNeighbors = lVal + rVal + tVal + bVal
                val newVal = ((6 * cVal - sumNeighbors) / 2).coerceIn(0, 255)

                outPixels[idx] = 0xFF000000.toInt() or (newVal shl 16) or (newVal shl 8) or newVal
            }
        }

        val outBmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        outBmp.setPixels(outPixels, 0, width, 0, 0, width, height)
        return outBmp
    }
}
