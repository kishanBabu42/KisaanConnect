package com.kisaanconnect.ui.auth

import android.os.Bundle
import android.os.CountDownTimer
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.kisaanconnect.R
import com.kisaanconnect.databinding.FragmentForgotPasswordBinding
import com.kisaanconnect.ui.viewmodel.AuthViewModel
import com.kisaanconnect.utils.*

class ForgotPasswordFragment : Fragment() {
    private var _binding: FragmentForgotPasswordBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentForgotPasswordBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.etEmail.doAfterTextChanged { binding.tilEmail.error = null }
        binding.btnSendOtp.setOnClickListener {
            val email = binding.etEmail.text.toString().trim()
            if (!email.isValidEmail()) {
                binding.tilEmail.error = getString(R.string.error_invalid_email)
                return@setOnClickListener
            }
            viewModel.otpEmail = email
            viewModel.requestOtp(email)
        }
        binding.btnBack.setOnClickListener { findNavController().navigateUp() }
        viewModel.otpState.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Loading -> {
                    binding.btnSendOtp.isEnabled = false
                    binding.progressBar.show()
                    binding.btnSendOtp.text = "Sending…"
                }
                is Resource.Success -> {
                    binding.progressBar.hide()
                    binding.btnSendOtp.isEnabled = true
                    binding.btnSendOtp.text = "Resend OTP"
                    if (state.data.success) {
                        findNavController().navigate(R.id.action_forgotPasswordFragment_to_otpFragment)
                    } else {
                        toast(state.data.message ?: "Could not send OTP. Try again.")
                    }
                }
                is Resource.Error -> {
                    binding.progressBar.hide()
                    binding.btnSendOtp.isEnabled = true
                    binding.btnSendOtp.text = getString(R.string.send_otp)
                    toast(state.message)
                }
                else -> { binding.progressBar.hide(); binding.btnSendOtp.isEnabled = true }
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}

class OtpFragment : Fragment() {
    private var _binding: FragmentForgotPasswordBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AuthViewModel by activityViewModels()
    private var countDownTimer: CountDownTimer? = null
    private var verifiedOtp: String = ""

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentForgotPasswordBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        startTimer()
        binding.btnBack.setOnClickListener { findNavController().navigateUp() }
        binding.btnSendOtp.text = getString(R.string.verify_otp)
        binding.btnSendOtp.setOnClickListener {
            val otp = binding.etEmail.text.toString().trim()
            if (otp.length != 6) { toast("Please enter the 6-digit OTP"); return@setOnClickListener }
            viewModel.verifyOtp(viewModel.otpEmail, otp)
            verifiedOtp = otp
        }
        viewModel.verifyState.observe(viewLifecycleOwner) { state ->
            when (state) {
                is Resource.Success -> {
                    if (state.data.success) {
                        findNavController().navigate(R.id.action_otpFragment_to_resetPasswordFragment)
                    } else { toast(state.data.message ?: "Invalid OTP") }
                }
                is Resource.Error -> toast(state.message)
                else -> {}
            }
        }
    }

    private fun startTimer() {
        countDownTimer?.cancel()
        countDownTimer = object : CountDownTimer(60_000, 1_000) {
            override fun onTick(ms: Long) {
                binding.tvTimer?.text = "Resend in ${ms / 1000}s"
            }
            override fun onFinish() {
                binding.tvTimer?.text = "Resend OTP"
                binding.tvTimer?.setOnClickListener { viewModel.requestOtp(viewModel.otpEmail) }
            }
        }.start()
    }

    override fun onDestroyView() { countDownTimer?.cancel(); super.onDestroyView(); _binding = null }
}
