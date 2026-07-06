package com.jubayer.cheatlock.model

import com.google.gson.annotations.SerializedName

enum class UserRole {
    @SerializedName("STUDENT") STUDENT,
    @SerializedName("TEACHER") TEACHER
}

data class UserAccount(
    val name: String = "User",
    val identifier: String = "",
    val password: String = "",
    val role: UserRole = UserRole.STUDENT
)
