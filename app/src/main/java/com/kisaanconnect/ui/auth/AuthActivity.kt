package com.kisaanconnect.ui.auth

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import com.kisaanconnect.R
import com.kisaanconnect.databinding.ActivityAuthBinding

class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding
    private lateinit var navController: NavController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.auth_nav_host) as NavHostFragment
        navController = navHostFragment.navController

        // Route based on intent extra
        val destination = intent.getStringExtra("destination") ?: "login"
        val navGraph = navController.navInflater.inflate(R.navigation.nav_auth)
        navGraph.setStartDestination(
            when (destination) {
                "onboarding" -> R.id.onboardingFragment
                "login" -> R.id.loginFragment
                else -> R.id.loginFragment
            }
        )
        navController.setGraph(navGraph, null)
    }

    override fun onSupportNavigateUp(): Boolean =
        navController.navigateUp() || super.onSupportNavigateUp()
}
