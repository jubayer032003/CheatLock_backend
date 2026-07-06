package com.jubayer.cheatlock.util

object IdentifierNormalizer {
    fun normalize(raw: String): String {
        return raw.trim().lowercase().replace("\\s+".toRegex(), "")
    }
}
