package com.jubayer.cheatlock.model

data class StudentNotification(
    val id: String,
    val studentId: String,
    val examId: String,
    val type: String,
    val payload: NotificationPayload = NotificationPayload(),
    val notified: Boolean = false,
    val createdAt: String? = null
)

data class NotificationPayload(
    val title: String? = null,
    val accessCode: String? = null,
    val message: String? = null,
    val grade: Double? = null,
    val feedback: String? = null,
    val gradedAt: String? = null
)

data class ExamAttendanceOverview(
    val exam: ExamAttendanceExam,
    val summary: ExamAttendanceSummary,
    val students: List<ExamAttendanceStudent>
)

data class ExamAttendanceExam(
    val id: String,
    val title: String,
    val accessCode: String? = null,
    val status: String? = null
)

data class ExamAttendanceSummary(
    val totalAssigned: Int,
    val attended: Int,
    val submitted: Int,
    val graded: Int
)

data class ExamAttendanceStudent(
    val studentId: String,
    val studentName: String? = null,
    val sessionStatus: String,
    val onlineStatus: String? = null,
    val attended: Boolean,
    val submitted: Boolean,
    val grade: Double? = null,
    val feedback: String? = null,
    val gradedAt: String? = null,
    val submittedAt: Long? = null,
    val totalWarnings: Int = 0,
    val riskLevel: String? = null
)
