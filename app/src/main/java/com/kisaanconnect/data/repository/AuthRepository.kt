package com.kisaanconnect.data.repository

import com.kisaanconnect.data.models.*
import com.kisaanconnect.data.network.ApiClient
import com.kisaanconnect.utils.Resource
import com.kisaanconnect.utils.safeApiCall

class AuthRepository {
    private val api = ApiClient.service

    suspend fun login(email: String, password: String, role: String): Resource<AuthResponse> =
        safeApiCall { api.login(LoginRequest(email, password, role)) }

    suspend fun register(
        email: String, password: String, name: String,
        mobile: String, location: String, role: String
    ): Resource<AuthResponse> =
        safeApiCall { api.register(RegisterRequest(email, password, name, mobile, location, role)) }

    suspend fun requestOtp(email: String): Resource<GenericResponse> =
        safeApiCall { api.requestOtp(OtpRequest(email)) }

    suspend fun verifyOtp(email: String, otp: String): Resource<GenericResponse> =
        safeApiCall { api.verifyOtp(OtpVerifyRequest(email, otp)) }

    suspend fun resetPassword(email: String, otp: String, newPassword: String): Resource<GenericResponse> =
        safeApiCall { api.resetPassword(ResetPasswordRequest(email, otp, newPassword)) }
}
