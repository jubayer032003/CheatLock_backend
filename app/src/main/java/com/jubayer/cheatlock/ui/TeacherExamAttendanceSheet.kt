package com.jubayer.cheatlock.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jubayer.cheatlock.model.ExamAttendanceOverview
import com.jubayer.cheatlock.model.ExamAttendanceStudent
import com.jubayer.cheatlock.model.ExamSubmission
import com.jubayer.cheatlock.ui.theme.CheatLockSuccess
import com.jubayer.cheatlock.ui.theme.CheatLockWarning
import kotlinx.coroutines.launch

@Composable
fun ExamAttendanceGradingSheet(
    examId: String,
    examTitle: String,
    onLoadOverview: suspend (String) -> ExamAttendanceOverview,
    onLoadSubmission: suspend (String, String) -> ExamSubmission?,
    onGradeSubmission: suspend (String, String, Double, String) -> ExamSubmission,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var overview by remember { mutableStateOf<ExamAttendanceOverview?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var message by remember { mutableStateOf<String?>(null) }
    var selectedStudent by remember { mutableStateOf<ExamAttendanceStudent?>(null) }
    var selectedSubmission by remember { mutableStateOf<ExamSubmission?>(null) }
    var gradeInput by remember { mutableStateOf("") }
    var feedbackInput by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }

    fun refreshOverview() {
        scope.launch {
            isLoading = true
            runCatching { onLoadOverview(examId) }
                .onSuccess { overview = it }
                .onFailure { error -> message = error.message ?: "Could not load attendance." }
            isLoading = false
        }
    }

    LaunchedEffect(examId) {
        refreshOverview()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Attendance & grading") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(examTitle, style = MaterialTheme.typography.titleMedium)

                if (isLoading) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator()
                    }
                } else {
                    overview?.let { data ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            QuickStatCard(
                                label = "Assigned",
                                value = data.summary.totalAssigned.toString(),
                                icon = Icons.Default.Groups,
                                modifier = Modifier.weight(1f)
                            )
                            QuickStatCard(
                                label = "Attended",
                                value = data.summary.attended.toString(),
                                icon = Icons.Default.School,
                                modifier = Modifier.weight(1f),
                                accent = CheatLockWarning
                            )
                            QuickStatCard(
                                label = "Submitted",
                                value = data.summary.submitted.toString(),
                                icon = Icons.Default.Upload,
                                modifier = Modifier.weight(1f)
                            )
                            QuickStatCard(
                                label = "Graded",
                                value = data.summary.graded.toString(),
                                icon = Icons.Default.CheckCircle,
                                modifier = Modifier.weight(1f),
                                accent = CheatLockSuccess
                            )
                        }

                        data.students.forEach { student ->
                            PremiumCard(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(student.studentName ?: student.studentId)
                                    Text(
                                        "Status: ${student.sessionStatus}",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    Text(
                                        buildString {
                                            append(if (student.attended) "Attended" else "Not attended")
                                            append(" • ")
                                            append(if (student.submitted) "Submitted" else "No submission")
                                            if (student.grade != null) append(" • Grade: ${student.grade}")
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    OutlinedButton(
                                        onClick = {
                                            selectedStudent = student
                                            gradeInput = student.grade?.toString().orEmpty()
                                            feedbackInput = student.feedback.orEmpty()
                                            selectedSubmission = null
                                            scope.launch {
                                                if (student.submitted) {
                                                    runCatching {
                                                        onLoadSubmission(examId, student.studentId)
                                                    }.onSuccess { submission ->
                                                        selectedSubmission = submission
                                                    }.onFailure { error ->
                                                        message = error.message
                                                    }
                                                }
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            if (student.submitted) "Review & grade" else "View status"
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                selectedStudent?.let { student ->
                    PremiumCard(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                "Grading ${student.studentId}",
                                style = MaterialTheme.typography.titleSmall
                            )
                            selectedSubmission?.let { submission ->
                                 Text(
                                     "Warnings: ${submission.totalWarnings} (${submission.riskLevel.orEmpty()})",
                                     style = MaterialTheme.typography.bodySmall
                                 )
                                submission.answers.take(3).forEach { answer ->
                                    Text(
                                        "Q: ${answer.questionText.take(60)}",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    Text(
                                        "A: ${answer.answerText.take(120).ifBlank { "(blank)" }}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                if (submission.answers.size > 3) {
                                    Text(
                                        "+${submission.answers.size - 3} more answers",
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            } ?: Text(
                                if (student.submitted) {
                                    "Loading submission..."
                                } else {
                                    "No submission yet — student has not finished."
                                },
                                style = MaterialTheme.typography.bodySmall
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = gradeInput,
                                onValueChange = { gradeInput = it },
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("Grade") },
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = feedbackInput,
                                onValueChange = { feedbackInput = it },
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("Feedback") },
                                minLines = 2
                            )
                            Button(
                                onClick = {
                                    val grade = gradeInput.toDoubleOrNull()
                                    if (grade == null) {
                                        message = "Enter a valid numeric grade."
                                        return@Button
                                    }
                                    isSaving = true
                                    scope.launch {
                                        runCatching {
                                            onGradeSubmission(
                                                examId,
                                                student.studentId,
                                                grade,
                                                feedbackInput.trim()
                                            )
                                        }.onSuccess {
                                            message = "Grade saved. Student will be notified."
                                            refreshOverview()
                                        }.onFailure { error ->
                                            message = error.message ?: "Could not save grade."
                                        }
                                        isSaving = false
                                    }
                                },
                                enabled = !isSaving && student.submitted,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(if (isSaving) "Saving..." else "Save grade & notify student")
                            }
                        }
                    }
                }

                message?.let {
                    Text(
                        it,
                        color = if (it.contains("saved", true)) CheatLockSuccess else MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        },
        confirmButton = {
            OutlinedButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}
