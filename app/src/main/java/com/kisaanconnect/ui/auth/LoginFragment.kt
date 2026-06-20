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
import com.kisaanconnect.databinding.FragmentLoginBinding
import com.kisaanconnect.ui.farmer.FarmerActivity
import com.kisaanconnect.ui.main.MainActivity
import com.kisaanconnect.ui.viewmodel.AuthViewModel
import com.kisaanconnect.utils.Resource
import com.kisaanconnect.utils.hide
import com.kisaanconnect.utils.isValidEmail
import com.kisaanconnect.utils.isValidPassword
import com.kisaanconnect.utils.show
import com.kisaanconnect.utils.toast

class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
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
        binding.etEmail.doAfterTextChanged {
            binding.tilEmail.error = null
        }
        binding.etPassword.doAfterTextChanged {
            binding.tilPassword.error = null
        }
    }

    private fun setupClickListeners() {
        binding.btnLogin.setOnClickListener { attemptLogin() }

        binding.tvCreateAccount.setOnClickListener {
            findNavController().navigate(R.id.action_loginFragment_to_registerFragment)
        }

        binding.tvForgotPassword.setOnClickListener {
            findNavController().navigate(R.id.action_loginFragment_to_forgotPasswordFragment)
        }
    }

    private fun attemptLogin() {
        val email = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString()
        var valid = true

        if (!email.isValidEmail()) {
            binding.tilEmail.error = getString(R.string.error_invalid_email)
            valid = false
        }
        if (!password.isValidPassword()) {
            binding.tilPassword.error = getString(R.string.error_password_short)
            valid = false
        }
        if (!valid) return

        viewModel.login(email, password, viewModel.selectedRole)
    }

    private fun observeViewModel() {
        viewModel.loginState.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Loading -> {
                    binding.progressBar.show()
                    binding.btnLogin.isEnabled = false
                    binding.btnLogin.text = "Signing in…"
                }
                is Resource.Success -> {
                    binding.progressBar.hide()
                    binding.btnLogin.isEnabled = true
                    binding.btnLogin.text = getString(R.string.login)
                    val user = state.data.user
                    val token = state.data.token
                    if (user != null && !token.isNullOrBlank()) {
                        KisaanApp.instance.prefs.saveSession(token, user)
                        val intent = if (user.isFarmer()) {
                            Intent(requireContext(), FarmerActivity::class.java)
                        } else {
                            Intent(requireContext(), MainActivity::class.java)
                        }
                        startActivity(intent)
                        requireActivity().finish()
                    } else {
                        toast(state.data.message ?: getString(R.string.error_login_failed))
                    }
                }
                is Resource.Error -> {
                    binding.progressBar.hide()
                    binding.btnLogin.isEnabled = true
                    binding.btnLogin.text = getString(R.string.login)
                    toast(state.message)
                }
                else -> {
                    binding.progressBar.hide()
                    binding.btnLogin.isEnabled = true
                }
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
