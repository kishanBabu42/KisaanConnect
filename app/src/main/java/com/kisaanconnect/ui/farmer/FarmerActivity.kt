package com.kisaanconnect.ui.farmer

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.R
import com.kisaanconnect.databinding.ActivityFarmerBinding
import com.kisaanconnect.ui.auth.AuthActivity

class FarmerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityFarmerBinding
    private lateinit var navController: NavController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFarmerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (!KisaanApp.instance.prefs.isLoggedIn || !KisaanApp.instance.prefs.isFarmer) {
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
            return
        }

        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.farmer_nav_host) as NavHostFragment
        navController = navHostFragment.navController

        binding.farmerBottomNav.setupWithNavController(navController)

        navController.addOnDestinationChangedListener { _, destination, _ ->
            val topLevelDests = listOf(
                R.id.farmerHomeFragment,
                R.id.farmerProductsFragment,
                R.id.farmerBidsFragment,
                R.id.farmerEarningsFragment,
                R.id.farmerProfileFragment
            )
            binding.farmerBottomNav.visibility =
                if (destination.id in topLevelDests) View.VISIBLE else View.GONE
        }
    }

    override fun onSupportNavigateUp() =
        navController.navigateUp() || super.onSupportNavigateUp()
}
