package com.jubayer.cheatlock.model

data class ExamSubmission(
    val id: String? = null,
    val examId: String? = null,
    val studentId: String,
    val answers: List<StudentAnswer>,
    val appSwitchWarnings: Int,
    val faceMissingWarnings: Int,
    val audioWarnings: Int = 0,
    val phoneWarnings: Int = 0,
    val totalWarnings: Int,
    val riskLevel: String,
    val submittedAt: Long,
    val grade: Double? = null,
    val feedback: String? = null,
    val gradedAt: String? = null
)

data class StudentAnswer(
    val questionIndex: Int,
    val questionText: String,
    val answerText: String
)