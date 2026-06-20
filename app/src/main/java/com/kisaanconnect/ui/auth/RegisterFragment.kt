package com.kisaanconnect.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.kisaanconnect.KisaanApp
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentRegisterBinding
import com.kisaanconnect.ui.farmer.FarmerActivity
import com.kisaanconnect.ui.main.MainActivity
import com.kisaanconnect.ui.viewmodel.AuthViewModel
import com.kisaanconnect.utils.*

class RegisterFragment : Fragment() {

    private var _binding: FragmentRegisterBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentRegisterBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRoleSelector()
        setupInputValidation()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupRoleSelector() {
        binding.chipCustomer.isChecked = true
        viewModel.selectedRole = "customer"
        binding.chipGroupRole.setOnCheckedStateChangeListener { _, checkedIds ->
            viewModel.selectedRole = if (checkedIds.contains(R.id.chipFarmer)) "farmer" else "customer"
        }
    }

    private fun setupInputValidation() {
        binding.etName.doAfterTextChanged { binding.tilName.error = null }
        binding.etEmail.doAfterTextChanged { binding.tilEmail.error = null }
        binding.etMobile.doAfterTextChanged { binding.tilMobile.error = null }
        binding.etPassword.doAfterTextChanged { binding.tilPassword.error = null }
        binding.etConfirmPassword.doAfterTextChanged { binding.tilConfirmPassword.error = null }
        binding.etLocation.doAfterTextChanged { binding.tilLocation.error = null }
    }

    private fun setupClickListeners() {
        binding.btnRegister.setOnClickListener { attemptRegister() }
        binding.tvLogin.setOnClickListener { findNavController().navigateUp() }
    }

    private fun attemptRegister() {
        val name = binding.etName.text.toString().trim()
        val email = binding.etEmail.text.toString().trim()
        val mobile = binding.etMobile.text.toString().trim()
        val password = binding.etPassword.text.toString()
        val confirmPass = binding.etConfirmPassword.text.toString()
        val location = binding.etLocation.text.toString().trim()
        var valid = true

        if (name.isBlank()) { binding.tilName.error = "Please enter your name"; valid = false }
        if (!email.isValidEmail()) { binding.tilEmail.error = getString(R.string.error_invalid_email); valid = false }
        if (!mobile.isValidMobile()) { binding.tilMobile.error = "Enter a valid 10-digit mobile number"; valid = false }
        if (!password.isValidPassword()) { binding.tilPassword.error = getString(R.string.error_password_short); valid = false }
        if (password != confirmPass) { binding.tilConfirmPassword.error = getString(R.string.error_password_mismatch); valid = false }
        if (location.isBlank()) { binding.tilLocation.error = "Please enter your location"; valid = false }
        if (!valid) return

        viewModel.register(email, password, name, mobile, location, viewModel.selectedRole)
    }

    private fun observeViewModel() {
        viewModel.registerState.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Loading -> {
                    binding.progressBar.show()
                    binding.btnRegister.isEnabled = false
                    binding.btnRegister.text = "Creating account…"
                }
                is Resource.Success -> {
                    binding.progressBar.hide()
                    binding.btnRegister.isEnabled = true
                    binding.btnRegister.text = getString(R.string.register)
                    val user = state.data.user
                    val token = state.data.token
                    if (user != null && !token.isNullOrBlank()) {
                        KisaanApp.instance.prefs.saveSession(token, user)
                        val intent = if (user.isFarmer())
                            Intent(requireContext(), FarmerActivity::class.java)
                        else
                            Intent(requireContext(), MainActivity::class.java)
                        startActivity(intent)
                        requireActivity().finish()
                    } else {
                        toast(state.data.message ?: "Registration failed. Please try again.")
                    }
                }
                is Resource.Error -> {
                    binding.progressBar.hide()
                    binding.btnRegister.isEnabled = true
                    binding.btnRegister.text = getString(R.string.register)
                    toast(state.message)
                }
                else -> {
                    binding.progressBar.hide()
                    binding.btnRegister.isEnabled = true
                }
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
