package com.jubayer.cheatlock.auth

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricAuthManager(
    private val activity: FragmentActivity
) {
    fun canAuthenticate(): Boolean {
        return try {
            val authenticators =
                BiometricManager.Authenticators.BIOMETRIC_WEAK or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL

            BiometricManager.from(activity).canAuthenticate(authenticators) ==
                BiometricManager.BIOMETRIC_SUCCESS
        } catch (t: Throwable) {
            android.util.Log.e("BiometricAuthManager", "canAuthenticate check failed", t)
            false
        }
    }

    fun authenticate(
        title: String,
        subtitle: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(
                    result: BiometricPrompt.AuthenticationResult
                ) {
                    super.onAuthenticationSucceeded(result)
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        if (!activity.isFinishing && !activity.isDestroyed) {
                            try {
                                onSuccess()
                            } catch (t: Throwable) {
                                android.util.Log.e("BiometricAuthManager", "onSuccess callback failed", t)
                            }
                        }
                    }, 300L)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        if (!activity.isFinishing && !activity.isDestroyed) {
                            try {
                                onError(errString.toString())
                            } catch (t: Throwable) {
                                android.util.Log.e("BiometricAuthManager", "onError callback failed", t)
                            }
                        }
                    }, 300L)
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        if (!activity.isFinishing && !activity.isDestroyed) {
                            try {
                                onError("Face or biometric verification failed. Try again.")
                            } catch (t: Throwable) {
                                android.util.Log.e("BiometricAuthManager", "onFailed callback failed", t)
                            }
                        }
                    }, 300L)
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_WEAK or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        prompt.authenticate(promptInfo)
    }
}
