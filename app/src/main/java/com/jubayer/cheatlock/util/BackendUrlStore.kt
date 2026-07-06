package com.jubayer.cheatlock.util

import android.content.Context
import com.jubayer.cheatlock.BuildConfig

object BackendUrlStore {
    private const val PREFS = "cheatlock_api_settings"
    private const val KEY_BASE_URL = "base_url"

    fun getCustomUrl(context: Context): String? {
        return context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_BASE_URL, null)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
    }

    fun setCustomUrl(context: Context, url: String) {
        val normalized = BackendUrlResolver.normalizeForStorage(url)
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BASE_URL, normalized)
            .apply()
    }

    fun clearCustomUrl(context: Context) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_BASE_URL)
            .apply()
    }

    fun configuredUrl(context: Context): String {
        return getCustomUrl(context) ?: BuildConfig.CHEATLOCK_API_BASE_URL
    }

    fun effectiveUrl(context: Context): String {
        return BackendUrlResolver.resolve(configuredUrl(context))
    }
}
