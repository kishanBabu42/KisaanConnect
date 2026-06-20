package com.kisaanconnect.data.repository

import com.kisaanconnect.data.models.*
import com.kisaanconnect.data.network.ApiClient
import com.kisaanconnect.utils.Resource
import com.kisaanconnect.utils.safeApiCall

class OrderRepository {
    private val api = ApiClient.service

    suspend fun getOrders(userId: Int): Resource<List<Order>> =
        safeApiCall { api.getOrders(userId) }

    suspend fun getOrderById(id: Int): Resource<Order> =
        safeApiCall { api.getOrderById(id) }

    suspend fun updateOrderStatus(id: Int, status: String): Resource<GenericResponse> =
        safeApiCall { api.updateOrderStatus(id, mapOf("status" to status)) }
}

class UserRepository {
    private val api = ApiClient.service

    suspend fun getUserById(id: Int): Resource<AuthResponse> =
        safeApiCall { api.getUserById(id) }

    suspend fun getWalletBalance(id: Int): Resource<Map<String, Any>> =
        safeApiCall { api.getWalletBalance(id) }

    suspend fun getTransactions(id: Int): Resource<List<WalletTransaction>> =
        safeApiCall { api.getTransactions(id) }

    suspend fun topUpWallet(id: Int, amount: Double): Resource<GenericResponse> =
        safeApiCall { api.topUpWallet(id, mapOf("amount" to amount)) }
}

class NotificationRepository {
    private val api = ApiClient.service

    suspend fun getNotifications(userId: Int): Resource<List<AppNotification>> =
        safeApiCall { api.getNotifications(userId) }

    suspend fun markRead(id: Int): Resource<GenericResponse> =
        safeApiCall { api.markNotificationRead(id) }

    suspend fun markAllRead(userId: Int): Resource<GenericResponse> =
        safeApiCall { api.markAllRead(userId) }
}

class AiRepository {
    private val api = ApiClient.service

    suspend fun sendMessage(message: String, role: String): Resource<AiChatResponse> =
        safeApiCall { api.sendAiMessage(AiChatRequest(message, role)) }
}

class CalendarRepository {
    private val api = ApiClient.service

    suspend fun getNotes(userId: Int): Resource<List<CalendarNote>> =
        safeApiCall { api.getCalendarNotes(userId) }

    suspend fun saveNote(note: CalendarNote): Resource<CalendarNote> =
        safeApiCall { api.saveCalendarNote(note) }

    suspend fun deleteNote(id: Int): Resource<GenericResponse> =
        safeApiCall { api.deleteCalendarNote(id) }
}
