package com.kisaanconnect.ui.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kisaanconnect.data.models.AuthResponse
import com.kisaanconnect.data.models.GenericResponse
import com.kisaanconnect.data.repository.AuthRepository
import com.kisaanconnect.utils.Resource
import kotlinx.coroutines.launch

class AuthViewModel : ViewModel() {

    private val repository = AuthRepository()

    private val _loginState = MutableLiveData<Resource<AuthResponse>>()
    val loginState: LiveData<Resource<AuthResponse>> = _loginState

    private val _registerState = MutableLiveData<Resource<AuthResponse>>()
    val registerState: LiveData<Resource<AuthResponse>> = _registerState

    private val _otpState = MutableLiveData<Resource<GenericResponse>>()
    val otpState: LiveData<Resource<GenericResponse>> = _otpState

    private val _verifyState = MutableLiveData<Resource<GenericResponse>>()
    val verifyState: LiveData<Resource<GenericResponse>> = _verifyState

    private val _resetState = MutableLiveData<Resource<GenericResponse>>()
    val resetState: LiveData<Resource<GenericResponse>> = _resetState

    // Shared state between fragments
    var selectedRole: String = "customer"
    var otpEmail: String = ""

    fun login(email: String, password: String, role: String) {
        _loginState.value = Resource.Loading
        viewModelScope.launch {
            _loginState.value = repository.login(email, password, role)
        }
    }

    fun register(email: String, password: String, name: String,
                 mobile: String, location: String, role: String) {
        _registerState.value = Resource.Loading
        viewModelScope.launch {
            _registerState.value = repository.register(email, password, name, mobile, location, role)
        }
    }

    fun requestOtp(email: String) {
        _otpState.value = Resource.Loading
        viewModelScope.launch {
            _otpState.value = repository.requestOtp(email)
        }
    }

    fun verifyOtp(email: String, otp: String) {
        _verifyState.value = Resource.Loading
        viewModelScope.launch {
            _verifyState.value = repository.verifyOtp(email, otp)
        }
    }

    fun resetPassword(email: String, otp: String, newPassword: String) {
        _resetState.value = Resource.Loading
        viewModelScope.launch {
            _resetState.value = repository.resetPassword(email, otp, newPassword)
        }
    }

    fun resetLoginState() { _loginState.value = Resource.Idle }
    fun resetRegisterState() { _registerState.value = Resource.Idle }
}
