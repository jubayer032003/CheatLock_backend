package com.jubayer.cheatlock.data

import android.content.Context
import com.jubayer.cheatlock.model.ExamSubmission
import com.jubayer.cheatlock.model.ExamSession
import com.jubayer.cheatlock.model.ExamSessionStatus
import com.jubayer.cheatlock.model.StudentAnswer
import com.jubayer.cheatlock.model.UserAccount
import com.jubayer.cheatlock.model.UserRole
import org.json.JSONArray
import org.json.JSONObject

class ExamStorage(context: Context) {

    private val prefs = context.getSharedPreferences(
        "cheatlock_exam_storage",
        Context.MODE_PRIVATE
    )

    fun saveAnswer(questionIndex: Int, answer: String) {
        prefs.edit()
            .putString("answer_$questionIndex", answer)
            .apply()
    }

    fun getAnswer(questionIndex: Int): String {
        return prefs.getString("answer_$questionIndex", "") ?: ""
    }

    fun saveWarnings(appWarnings: Int, faceWarnings: Int) {
        prefs.edit()
            .putInt("app_warnings", appWarnings)
            .putInt("face_warnings", faceWarnings)
            .apply()
    }

    fun createAccount(account: UserAccount): Boolean {
        val accounts = getAccounts().toMutableList()
        val exists = accounts.any {
            it.identifier.equals(account.identifier, ignoreCase = true) &&
                it.role == account.role
        }

        if (exists) {
            return false
        }

        accounts.add(account)
        prefs.edit()
            .putString("accounts", encodeAccounts(accounts))
            .apply()
        return true
    }

    fun login(identifier: String, password: String, role: UserRole): UserAccount? {
        return getAccounts().firstOrNull { account ->
            account.identifier.equals(identifier.trim(), ignoreCase = true) &&
                account.password == password &&
                account.role == role
        }
    }

    fun getAccounts(): List<UserAccount> {
        val raw = prefs.getString("accounts", null) ?: return emptyList()
        return try {
            val json = JSONArray(raw)
            List(json.length()) { index ->
                val item = json.getJSONObject(index)
                val roleStr = item.optString("role", "STUDENT")
                val role = try {
                    UserRole.valueOf(roleStr)
                } catch (e: Exception) {
                    UserRole.STUDENT
                }
                UserAccount(
                    name = item.optString("name", ""),
                    identifier = item.optString("identifier", ""),
                    password = item.optString("password", ""),
                    role = role
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("CHEATLOCK_FLOW", "Error parsing accounts JSON in ExamStorage", e)
            emptyList()
        }
    }

    fun saveSubmission(submission: ExamSubmission) {
        val submissions = getSubmissions().toMutableList()
        submissions.add(0, submission)

        prefs.edit()
            .putString("submissions", encodeSubmissions(submissions.take(50)))
            .apply()
    }

    fun getSubmissions(): List<ExamSubmission> {
        val raw = prefs.getString("submissions", null) ?: return emptyList()
        return try {
            val json = JSONArray(raw)

            List(json.length()) { index ->
                val item = json.getJSONObject(index)
                val answersJson = item.optJSONArray("answers") ?: JSONArray()
                val answers = List(answersJson.length()) { answerIndex ->
                    val answer = answersJson.getJSONObject(answerIndex)
                    StudentAnswer(
                        questionIndex = answer.optInt("questionIndex", 0),
                        questionText = answer.optString("questionText", ""),
                        answerText = answer.optString("answerText", "")
                    )
                }

                ExamSubmission(
                    id = item.optStringOrNull("id"),
                    examId = item.optStringOrNull("examId"),
                    studentId = item.optString("studentId", "unknown"),
                    answers = answers,
                    appSwitchWarnings = item.optInt("appSwitchWarnings", 0),
                    faceMissingWarnings = item.optInt("faceMissingWarnings", 0),
                    audioWarnings = item.optInt("audioWarnings", 0),
                    phoneWarnings = item.optInt("phoneWarnings", 0),
                    totalWarnings = item.optInt("totalWarnings", 0),
                    riskLevel = item.optString("riskLevel", "LOW"),
                    submittedAt = item.optLong("submittedAt", 0L),
                    grade = item.optDoubleOrNull("grade"),
                    feedback = item.optStringOrNull("feedback"),
                    gradedAt = item.optStringOrNull("gradedAt")
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("ExamStorage", "Error parsing submissions JSON", e)
            emptyList()
        }
    }

    fun clearSubmissions() {
        prefs.edit()
            .remove("submissions")
            .apply()
    }

    fun getSession(studentId: String): ExamSession {
        val raw = prefs.getString("session_$studentId", null)
            ?: return ExamSession(studentId = studentId, status = ExamSessionStatus.NOT_STARTED)
        return try {
            val json = JSONObject(raw)
            val statusStr = json.optString("status", "NOT_STARTED")
            val status = try {
                ExamSessionStatus.valueOf(statusStr)
            } catch (e: Exception) {
                ExamSessionStatus.NOT_STARTED
            }
            ExamSession(
                studentId = json.optString("studentId", studentId),
                status = status,
                startedAt = json.optLongOrNull("startedAt"),
                submittedAt = json.optLongOrNull("submittedAt"),
                lockedAt = json.optLongOrNull("lockedAt"),
                resetAt = json.optLongOrNull("resetAt"),
                resetBy = json.optStringOrNull("resetBy"),
                lockReason = json.optStringOrNull("lockReason"),
                suspicionScore = json.optInt("suspicionScore", 0),
                latestAlert = json.optString("latestAlert", ""),
                onlineStatus = json.optString("onlineStatus", "OFFLINE"),
                previewUrl = json.optString("previewUrl", ""),
                previewBase64 = json.optString("previewBase64", ""),
                lastSeenAt = json.optLongOrNull("lastSeenAt")
            )
        } catch (e: Exception) {
            android.util.Log.e("CHEATLOCK_FLOW", "Error parsing session JSON in ExamStorage for student: $studentId", e)
            ExamSession(studentId = studentId, status = ExamSessionStatus.NOT_STARTED)
        }
    }

    fun saveSession(session: ExamSession) {
        prefs.edit()
            .putString("session_${session.studentId}", encodeSession(session))
            .apply()
    }

    fun getSessions(): List<ExamSession> {
        return prefs.all.keys
            .filter { it.startsWith("session_") }
            .map { key -> getSession(key.removePrefix("session_")) }
            .sortedByDescending {
                it.submittedAt ?: it.lockedAt ?: it.startedAt ?: it.resetAt ?: 0L
            }
    }

    fun clearExam() {
        prefs.edit()
            .remove("app_warnings")
            .remove("face_warnings")
            .apply()

        prefs.edit().apply {
            repeat(20) { index ->
                remove("answer_$index")
            }
        }.apply()
    }

    private fun encodeSubmissions(submissions: List<ExamSubmission>): String {
        val json = JSONArray()

        submissions.forEach { submission ->
            val answersJson = JSONArray()
            submission.answers.forEach { answer ->
                answersJson.put(
                    JSONObject()
                        .put("questionIndex", answer.questionIndex)
                        .put("questionText", answer.questionText)
                        .put("answerText", answer.answerText)
                )
            }

            json.put(
                JSONObject()
                    .put("studentId", submission.studentId)
                    .put("answers", answersJson)
                    .put("appSwitchWarnings", submission.appSwitchWarnings)
                    .put("faceMissingWarnings", submission.faceMissingWarnings)
                    .put("totalWarnings", submission.totalWarnings)
                    .put("riskLevel", submission.riskLevel)
                    .put("submittedAt", submission.submittedAt)
            )
        }

        return json.toString()
    }

    private fun encodeAccounts(accounts: List<UserAccount>): String {
        val json = JSONArray()

        accounts.forEach { account ->
            json.put(
                JSONObject()
                    .put("name", account.name)
                    .put("identifier", account.identifier)
                    .put("password", account.password)
                    .put("role", account.role.name)
            )
        }

        return json.toString()
    }

    private fun encodeSession(session: ExamSession): String {
        return JSONObject()
            .put("studentId", session.studentId)
            .put("status", session.status.name)
            .put("startedAt", session.startedAt)
            .put("submittedAt", session.submittedAt)
            .put("lockedAt", session.lockedAt)
            .put("resetAt", session.resetAt)
            .put("resetBy", session.resetBy)
            .put("lockReason", session.lockReason)
            .put("suspicionScore", session.suspicionScore)
            .put("latestAlert", session.latestAlert)
            .put("onlineStatus", session.onlineStatus)
            .put("previewUrl", session.previewUrl)
            .put("previewBase64", session.previewBase64)
            .put("lastSeenAt", session.lastSeenAt)
            .toString()
    }

    private fun JSONObject.optLongOrNull(name: String): Long? {
        return if (has(name) && !isNull(name)) optLong(name) else null
    }

    private fun JSONObject.optDoubleOrNull(name: String): Double? {
        return if (has(name) && !isNull(name)) optDouble(name) else null
    }

    private fun JSONObject.optStringOrNull(name: String): String? {
        return if (has(name) && !isNull(name)) optString(name) else null
    }
}
