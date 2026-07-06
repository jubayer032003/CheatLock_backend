package com.jubayer.cheatlock.data

import com.jubayer.cheatlock.model.ExamAttendanceOverview
import com.jubayer.cheatlock.model.ExamSubmission
import com.jubayer.cheatlock.model.ExamSession
import com.jubayer.cheatlock.model.Exam
import com.jubayer.cheatlock.model.StudentNotification
import com.jubayer.cheatlock.model.TeacherClass
import com.jubayer.cheatlock.model.UserRole
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.http.PATCH

data class HealthResponse(
    val ok: Boolean,
    val service: String? = null
)

interface BackendApi {
    @GET("health")
    suspend fun health(): HealthResponse

    @POST("auth/signup")
    suspend fun signup(@Body request: AuthRequest): SignupResponse

    @POST("auth/login")
    suspend fun login(@Body request: AuthRequest): LoginResponse

    @GET("auth/me")
    suspend fun getMe(
        @Header("Authorization") authorization: String
    ): UserResponse

    @GET("auth/face-profile")
    suspend fun getFaceProfile(
        @Header("Authorization") authorization: String
    ): FaceProfileResponse

    @retrofit2.http.PUT("auth/face-profile")
    suspend fun enrollFaceProfile(
        @Header("Authorization") authorization: String,
        @Body request: FaceProfileRequest
    ): FaceProfileResponse

    @POST("auth/face-profile/verify")
    suspend fun verifyFaceProfile(
        @Header("Authorization") authorization: String,
        @Body request: FaceProfileRequest
    ): FaceVerificationResponse

    @POST("exams")
    suspend fun createExam(
        @Header("Authorization") authorization: String,
        @Body request: Exam
    ): ExamResponse

    @GET("exams")
    suspend fun getExams(
        @Header("Authorization") authorization: String
    ): ExamsResponse

    @PATCH("exams/{examId}/lifecycle")
    suspend fun updateExamLifecycle(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("examId") examId: String,
        @Body request: ExamLifecycleRequest
    ): ExamResponse

    @PATCH("exams/{examId}/assign-students")
    suspend fun assignStudentsToExam(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("examId") examId: String,
        @Body request: AssignStudentsRequest
    ): AssignStudentsResponse

    @GET("exams/assigned")
    suspend fun getAssignedExam(
        @Header("Authorization") authorization: String
    ): ExamResponse

    @GET("exams/access/{code}")
    suspend fun getExamByCode(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("code") code: String
    ): ExamResponse

    @GET("community")
    suspend fun getCommunity(
        @Header("Authorization") authorization: String
    ): CommunityResponse

    @GET("classes")
    suspend fun getClasses(
        @Header("Authorization") authorization: String
    ): ClassesResponse

    @POST("classes")
    suspend fun createClass(
        @Header("Authorization") authorization: String,
        @Body request: TeacherClass
    ): ClassResponse

    @POST("classes/join")
    suspend fun joinClass(
        @Header("Authorization") authorization: String,
        @Body request: ClassJoinRequest
    ): ClassJoinResponse

    @retrofit2.http.PUT("classes/{classId}")
    suspend fun updateClass(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("classId") classId: String,
        @Body request: TeacherClass
    ): ClassResponse

    @DELETE("classes/{classId}")
    suspend fun deleteClass(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("classId") classId: String
    )

    @POST("classes/{classId}/enrollment/{studentId}")
    suspend fun decideClassEnrollment(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("classId") classId: String,
        @retrofit2.http.Path("studentId") studentId: String,
        @Body request: EnrollmentDecisionRequest
    ): ClassResponse

    @retrofit2.http.PUT("community")
    suspend fun updateCommunity(
        @Header("Authorization") authorization: String,
        @Body request: CommunityRequest
    ): CommunityResponse

    @POST("submissions")
    suspend fun saveSubmission(
        @Header("Authorization") authorization: String,
        @Body submission: ExamSubmission
    )

    @GET("submissions")
    suspend fun getSubmissions(
        @Header("Authorization") authorization: String
    ): SubmissionsResponse

    @DELETE("submissions")
    suspend fun clearSubmissions(
        @Header("Authorization") authorization: String
    )

    @GET("sessions/me")
    suspend fun getMySession(
        @Header("Authorization") authorization: String,
        @Query("examId") examId: String? = null
    ): SessionResponse

    @POST("sessions/start")
    suspend fun startSession(
        @Header("Authorization") authorization: String,
        @Body request: SessionExamRequest = SessionExamRequest()
    ): SessionResponse

    @POST("sessions/submit")
    suspend fun submitSession(
        @Header("Authorization") authorization: String,
        @Body request: SessionExamRequest = SessionExamRequest()
    ): SessionResponse

    @POST("sessions/lock")
    suspend fun lockSession(
        @Header("Authorization") authorization: String,
        @Body request: LockSessionRequest
    ): SessionResponse

    @GET("sessions")
    suspend fun getSessions(
        @Header("Authorization") authorization: String
    ): SessionsResponse

    @GET("teacher/exams/{examId}/live-proctoring")
    suspend fun getLiveProctoring(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("examId") examId: String
    ): LiveProctoringResponse

    @POST("proctoring/events")
    suspend fun sendProctoringEvent(
        @Header("Authorization") authorization: String,
        @Body request: ProctoringEventRequest
    ): ProctoringEventResponse

    @GET("students/{studentId}/exams/{examId}/grade")
    suspend fun getSubmissionGrade(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("studentId") studentId: String,
        @retrofit2.http.Path("examId") examId: String
    ): SingleSubmissionResponse

    @GET("students/{studentId}/notifications")
    suspend fun getStudentNotifications(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("studentId") studentId: String,
        @Query("pending") pending: Boolean = true
    ): StudentNotificationsResponse

    @PATCH("students/{studentId}/notifications/{notificationId}/read")
    suspend fun markStudentNotificationRead(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("studentId") studentId: String,
        @retrofit2.http.Path("notificationId") notificationId: String
    ): StudentNotificationResponse

    @GET("teacher/exams/{examId}/overview")
    suspend fun getExamAttendanceOverview(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("examId") examId: String
    ): ExamAttendanceOverview

    @GET("teacher/exams/{examId}/submissions")
    suspend fun getExamSubmissions(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("examId") examId: String
    ): SubmissionsResponse

    @retrofit2.http.PUT("teacher/exams/{examId}/students/{studentId}/grade")
    suspend fun gradeExamSubmission(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("examId") examId: String,
        @retrofit2.http.Path("studentId") studentId: String,
        @Body request: GradeSubmissionRequest
    ): SingleSubmissionResponse

    @POST("sessions/{studentId}/reset")
    suspend fun resetSession(
        @Header("Authorization") authorization: String,
        @retrofit2.http.Path("studentId") studentId: String,
        @Body request: ResetSessionRequest = ResetSessionRequest()
    ): SessionResponse
}

data class AuthRequest(
    val name: String? = null,
    val identifier: String,
    val password: String,
    val role: UserRole
)

data class AuthUserDto(
    val name: String,
    val identifier: String,
    val role: UserRole
)

data class SignupResponse(
    val token: String,
    val user: AuthUserDto
)

data class LoginResponse(
    val token: String,
    val user: AuthUserDto
)

data class FaceProfileRequest(
    val descriptor: List<Double>,
    val previewBase64: String? = null
)

data class FaceProfileResponse(
    val ok: Boolean? = null,
    val hasFaceProfile: Boolean,
    val updatedAt: String? = null
)

data class FaceVerificationResponse(
    val ok: Boolean,
    val distance: Double,
    val threshold: Double
)

data class SubmissionsResponse(
    val submissions: List<ExamSubmission>
)

data class SingleSubmissionResponse(
    val submission: ExamSubmission
)

data class ExamResponse(
    val exam: Exam
)

data class ExamsResponse(
    val exams: List<Exam>
)

data class UserResponse(
    val user: AuthUserDto
)

data class Community(
    val teacherId: String,
    val students: List<String>
)

data class CommunityRequest(
    val students: List<String>
)

data class CommunityResponse(
    val community: Community
)

data class ClassesResponse(
    val classes: List<TeacherClass>
)

data class ClassResponse(
    val `class`: TeacherClass
)

data class ClassJoinRequest(
    val inviteCode: String
)

data class ClassJoinResponse(
    val `class`: TeacherClass,
    val status: String
)

data class EnrollmentDecisionRequest(
    val decision: String
)

data class SessionResponse(
    val session: ExamSession
)

data class SessionsResponse(
    val sessions: List<ExamSession>
)

data class SessionExamRequest(
    val examId: String? = null,
    val deviceId: String? = null
)

data class ExamLifecycleRequest(
    val action: String,
    val scheduledStartAt: String? = null,
    val scheduledEndAt: String? = null
)

data class AssignStudentsRequest(
    val studentIds: List<String>
)

data class AssignStudentsResponse(
    val exam: Exam,
    val addedStudents: List<String> = emptyList()
)

data class ResetSessionRequest(
    val examId: String? = null
)

data class LiveProctoringResponse(
    val exam: LiveExam,
    val activeStudents: List<LiveStudent>
)

data class LiveExam(
    val id: String,
    val title: String
)

data class LiveStudent(
    val studentId: String,
    val studentName: String,
    val rollId: String,
    val status: String,
    val suspicionScore: Int,
    val latestAlert: String,
    val onlineStatus: String,
    val previewUrl: String,
    val previewBase64: String,
    val lastUpdatedAt: String? = null,
    val lastSeenAt: Long? = null
)

data class ProctoringEventRequest(
    val eventName: String,
    val examId: String,
    val studentId: String? = null,
    val suspicionScore: Int? = null,
    val latestAlert: String? = null,
    val previewUrl: String? = null,
    val previewBase64: String? = null
)

data class ProctoringEventResponse(
    val ok: Boolean,
    val eventName: String,
    val student: LiveStudent
)

data class LockSessionRequest(
    val reason: String,
    val examId: String? = null
)

data class StudentNotificationsResponse(
    val notifications: List<StudentNotification>
)

data class StudentNotificationResponse(
    val notification: StudentNotification
)

data class GradeSubmissionRequest(
    val grade: Double,
    val feedback: String = ""
)
