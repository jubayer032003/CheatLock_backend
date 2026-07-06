package com.jubayer.cheatlock.model

data class TeacherClass(
    val id: String? = null,
    val teacherId: String = "",
    val name: String,
    val section: String = "",
    val subject: String = "",
    val students: List<String> = emptyList(),
    val inviteCode: String = "",
    val enrollmentRequests: List<EnrollmentRequest> = emptyList()
)

data class EnrollmentRequest(
    val studentId: String,
    val studentName: String = "",
    val status: String = "PENDING",
    val requestedAt: String? = null,
    val decidedAt: String? = null
)
