package com.kisaanconnect.utils

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.kisaanconnect.data.models.User

class PrefsManager(context: Context) {

    companion object {
        private const val PREF_NAME = "kisaan_prefs"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER = "current_user"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_ONBOARDED = "is_onboarded"
        private const val KEY_THEME = "app_theme"
        private const val KEY_LANGUAGE = "app_language"
        private const val KEY_NOTIFICATIONS = "notifications_enabled"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val KEY_BIOMETRIC = "biometric_enabled"
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    // ── Auth ──────────────────────────────────────────────────────────────────
    var authToken: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var currentUser: User?
        get() {
            val json = prefs.getString(KEY_USER, null) ?: return null
            return try { gson.fromJson(json, User::class.java) } catch (e: Exception) { null }
        }
        set(value) {
            val json = if (value != null) gson.toJson(value) else null
            prefs.edit().putString(KEY_USER, json).apply()
        }

    var userId: Int
        get() = prefs.getInt(KEY_USER_ID, -1)
        set(value) = prefs.edit().putInt(KEY_USER_ID, value).apply()

    var userRole: String
        get() = prefs.getString(KEY_USER_ROLE, "") ?: ""
        set(value) = prefs.edit().putString(KEY_USER_ROLE, value).apply()

    val isLoggedIn: Boolean
        get() = !authToken.isNullOrBlank() && userId > 0

    val isCustomer: Boolean
        get() = userRole.lowercase() == "customer"

    val isFarmer: Boolean
        get() = userRole.lowercase() == "farmer"

    // ── Onboarding ────────────────────────────────────────────────────────────
    var isOnboarded: Boolean
        get() = prefs.getBoolean(KEY_ONBOARDED, false)
        set(value) = prefs.edit().putBoolean(KEY_ONBOARDED, value).apply()

    // ── Settings ──────────────────────────────────────────────────────────────
    var appTheme: String
        get() = prefs.getString(KEY_THEME, "system") ?: "system"
        set(value) = prefs.edit().putString(KEY_THEME, value).apply()

    var appLanguage: String
        get() = prefs.getString(KEY_LANGUAGE, "en") ?: "en"
        set(value) = prefs.edit().putString(KEY_LANGUAGE, value).apply()

    var notificationsEnabled: Boolean
        get() = prefs.getBoolean(KEY_NOTIFICATIONS, true)
        set(value) = prefs.edit().putBoolean(KEY_NOTIFICATIONS, value).apply()

    var fcmToken: String?
        get() = prefs.getString(KEY_FCM_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_FCM_TOKEN, value).apply()

    var biometricEnabled: Boolean
        get() = prefs.getBoolean(KEY_BIOMETRIC, false)
        set(value) = prefs.edit().putBoolean(KEY_BIOMETRIC, value).apply()

    // ── Session ───────────────────────────────────────────────────────────────
    fun saveSession(token: String, user: User) {
        authToken = token
        currentUser = user
        userId = user.id
        userRole = user.role
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_ROLE)
            .apply()
    }
}
