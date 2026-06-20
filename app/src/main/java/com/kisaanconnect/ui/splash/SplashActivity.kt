package com.kisaanconnect.ui.splash

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.ui.auth.AuthActivity
import com.kisaanconnect.ui.farmer.FarmerActivity
import com.kisaanconnect.ui.main.MainActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@SuppressLint("CustomSplashScreen")
class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        var keepSplash = true
        splashScreen.setKeepOnScreenCondition { keepSplash }

        lifecycleScope.launch {
            delay(1200)
            keepSplash = false
            navigateNext()
        }
    }

    private fun navigateNext() {
        val prefs = KisaanApp.instance.prefs
        val intent = when {
            !prefs.isOnboarded -> Intent(this, AuthActivity::class.java)
                .putExtra("destination", "onboarding")
            !prefs.isLoggedIn -> Intent(this, AuthActivity::class.java)
                .putExtra("destination", "login")
            prefs.isFarmer -> Intent(this, FarmerActivity::class.java)
            else -> Intent(this, MainActivity::class.java)
        }
        startActivity(intent)
        finish()
    }
}
