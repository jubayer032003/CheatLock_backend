package com.jubayer.cheatlock.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.jubayer.cheatlock.model.StudentNotification

object StudentNotificationHelper {
    private const val CHANNEL_ID = "cheatlock_student_updates"

    fun show(context: Context, notification: StudentNotification) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val manager = NotificationManagerCompat.from(context)
        ensureChannel(context, manager)

        val title = notificationTitle(notification)
        val body = notification.payload.message?.takeIf { it.isNotBlank() }
            ?: notification.payload.title
            ?: "You have a new exam update."

        val androidNotification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        val notificationId = notification.id.hashCode()
        manager.notify(notificationId, androidNotification)
    }

    private fun notificationTitle(notification: StudentNotification): String {
        return when (notification.type) {
            "EXAM_CREATED" -> "New exam available"
            "EXAM_LIVE" -> "Exam is live"
            "EXAM_ASSIGNED" -> "Added to exam"
            "GRADE_ASSIGNED" -> "Exam graded"
            else -> "CheatLock update"
        }
    }

    private fun ensureChannel(
        context: Context,
        manager: NotificationManagerCompat
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Exam updates",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Exam creation, live status, and grading alerts"
        }
        manager.createNotificationChannel(channel)
    }
}
