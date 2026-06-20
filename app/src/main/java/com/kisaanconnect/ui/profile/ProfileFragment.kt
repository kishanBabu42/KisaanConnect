package com.kisaanconnect.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentProfileBinding
import com.kisaanconnect.ui.auth.AuthActivity
import com.kisaanconnect.ui.viewmodel.ProfileViewModel
import com.kisaanconnect.utils.*

class ProfileFragment : Fragment() {
    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ProfileViewModel by activityViewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupProfileInfo()
        setupMenuItems()
        observeViewModel()
        viewModel.loadProfile(KisaanApp.instance.prefs.userId)
    }

    private fun setupProfileInfo() {
        val user = KisaanApp.instance.prefs.currentUser
        user?.let {
            binding.tvName.text = it.displayName()
            binding.tvEmail.text = it.email
            binding.tvRole.text = it.role.replaceFirstChar { c -> c.uppercase() }
            binding.tvLocation.text = it.location
            binding.ivAvatar.loadCircle(it.avatar)
            binding.tvWalletBalance.text = it.walletBalance.toRupees()
        }
    }

    private fun setupMenuItems() {
        binding.rowEditProfile.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_editProfileFragment)
        }
        binding.rowNotifications.setOnClickListener { toast("Notification settings") }
        binding.rowAddresses.setOnClickListener { toast("Address management") }
        binding.rowSettings.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_settingsFragment)
        }
        binding.rowHelp.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_helpFragment)
        }
        binding.rowAbout.setOnClickListener { toast("KisaanConnect v2.0 — Smart Digital Platform") }
        binding.rowPrivacy.setOnClickListener { toast("Privacy Policy") }
        binding.rowTerms.setOnClickListener { toast("Terms & Conditions") }
        binding.btnLogout.setOnClickListener { confirmLogout() }
        binding.rowAiChat.setOnClickListener {
            findNavController().navigate(R.id.action_profileFragment_to_aiChatFragment)
        }
    }

    private fun confirmLogout() {
        AlertDialog.Builder(requireContext())
            .setTitle("Logout")
            .setMessage("Are you sure you want to logout?")
            .setPositiveButton("Logout") { _, _ ->
                KisaanApp.instance.prefs.clearSession()
                startActivity(Intent(requireContext(), AuthActivity::class.java)
                    .putExtra("destination", "login"))
                requireActivity().finish()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun observeViewModel() {
        viewModel.profile.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Success -> {
                    state.data.user?.let { user ->
                        KisaanApp.instance.prefs.currentUser = user
                        binding.tvName.text = user.displayName()
                        binding.tvEmail.text = user.email
                        binding.tvWalletBalance.text = user.walletBalance.toRupees()
                        binding.ivAvatar.loadCircle(user.avatar)
                    }
                }
                else -> {}
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
