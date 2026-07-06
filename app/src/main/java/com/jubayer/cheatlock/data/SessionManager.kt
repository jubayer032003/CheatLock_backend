package com.jubayer.cheatlock.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.jubayer.cheatlock.model.UserAccount

/**
 * Manages persistent user sessions using EncryptedSharedPreferences.
 */
class SessionManager(context: Context) {
    private val gson = Gson()
    
    private val prefs = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "cheatlock_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        android.util.Log.e("CHEATLOCK_FLOW", "Failed to initialize EncryptedSharedPreferences; falling back to standard SharedPreferences", e)
        context.getSharedPreferences("cheatlock_backup_session", Context.MODE_PRIVATE)
    }

    fun saveSession(token: String, user: UserAccount) {
        prefs.edit().apply {
            putString(KEY_TOKEN, token)
            putString(KEY_USER_JSON, gson.toJson(user))
            apply()
        }
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun getUser(): UserAccount? {
        val userJson = prefs.getString(KEY_USER_JSON, null) ?: return null
        return try {
            gson.fromJson(userJson, UserAccount::class.java)
        } catch (e: Exception) {
            null
        }
    }

    fun hasSession(): Boolean = !getToken().isNullOrBlank() && getUser() != null

    fun logout() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_JSON = "user_account"
    }
}
