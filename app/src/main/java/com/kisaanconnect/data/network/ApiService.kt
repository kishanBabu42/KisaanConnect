package com.kisaanconnect.data.network

import com.kisaanconnect.data.models.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ── Auth ──────────────────────────────────────────────────────────────────
    @POST("api/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/signup")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("api/forgot-password")
    suspend fun requestOtp(@Body request: OtpRequest): Response<GenericResponse>

    @POST("api/verify-otp")
    suspend fun verifyOtp(@Body request: OtpVerifyRequest): Response<GenericResponse>

    @POST("api/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): Response<GenericResponse>

    // ── Users ─────────────────────────────────────────────────────────────────
    @GET("api/users/{id}")
    suspend fun getUserById(@Path("id") id: Int): Response<AuthResponse>

    @Multipart
    @PUT("api/users/{id}")
    suspend fun updateProfile(
        @Path("id") id: Int,
        @Part("name") name: RequestBody,
        @Part("mobile") mobile: RequestBody,
        @Part("location") location: RequestBody,
        @Part avatar: MultipartBody.Part? = null
    ): Response<AuthResponse>

    @GET("api/users/{id}/wallet")
    suspend fun getWalletBalance(@Path("id") id: Int): Response<Map<String, Any>>

    @GET("api/users/{id}/transactions")
    suspend fun getTransactions(@Path("id") id: Int): Response<List<WalletTransaction>>

    @POST("api/users/{id}/topup")
    suspend fun topUpWallet(
        @Path("id") id: Int,
        @Body body: Map<String, Double>
    ): Response<GenericResponse>

    // ── Products ──────────────────────────────────────────────────────────────
    @GET("api/products")
    suspend fun getProducts(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("category") category: String? = null,
        @Query("search") search: String? = null,
        @Query("sort") sort: String? = null,
        @Query("minPrice") minPrice: Double? = null,
        @Query("maxPrice") maxPrice: Double? = null
    ): Response<ProductsResponse>

    @GET("api/products/{id}")
    suspend fun getProductById(@Path("id") id: Int): Response<Product>

    @GET("api/products/farmer/{farmerId}")
    suspend fun getProductsByFarmer(@Path("farmerId") farmerId: Int): Response<ProductsResponse>

    @Multipart
    @POST("api/products")
    suspend fun createProduct(
        @Part("name") name: RequestBody,
        @Part("description") description: RequestBody,
        @Part("price") price: RequestBody,
        @Part("marketPrice") marketPrice: RequestBody,
        @Part("quantity") quantity: RequestBody,
        @Part("category") category: RequestBody,
        @Part("location") location: RequestBody,
        @Part("freshness") freshness: RequestBody,
        @Part image: MultipartBody.Part? = null
    ): Response<Product>

    @Multipart
    @PUT("api/products/{id}")
    suspend fun updateProduct(
        @Path("id") id: Int,
        @Part("name") name: RequestBody,
        @Part("description") description: RequestBody,
        @Part("price") price: RequestBody,
        @Part("marketPrice") marketPrice: RequestBody,
        @Part("quantity") quantity: RequestBody,
        @Part("category") category: RequestBody,
        @Part("location") location: RequestBody,
        @Part("freshness") freshness: RequestBody,
        @Part image: MultipartBody.Part? = null
    ): Response<Product>

    @DELETE("api/products/{id}")
    suspend fun deleteProduct(@Path("id") id: Int): Response<GenericResponse>

    // ── Bids / Quotes ─────────────────────────────────────────────────────────
    @GET("api/bids")
    suspend fun getBids(@Query("userId") userId: Int): Response<List<Bid>>

    @GET("api/bids/farmer/{farmerId}")
    suspend fun getFarmerBids(@Path("farmerId") farmerId: Int): Response<List<Bid>>

    @POST("api/bids")
    suspend fun placeBid(@Body request: BidRequest): Response<Bid>

    @PUT("api/bids/{id}/accept")
    suspend fun acceptBid(@Path("id") id: Int): Response<GenericResponse>

    @PUT("api/bids/{id}/reject")
    suspend fun rejectBid(@Path("id") id: Int): Response<GenericResponse>

    // ── Orders ────────────────────────────────────────────────────────────────
    @GET("api/orders")
    suspend fun getOrders(@Query("userId") userId: Int): Response<List<Order>>

    @GET("api/orders/{id}")
    suspend fun getOrderById(@Path("id") id: Int): Response<Order>

    @PUT("api/orders/{id}/status")
    suspend fun updateOrderStatus(
        @Path("id") id: Int,
        @Body body: Map<String, String>
    ): Response<GenericResponse>

    // ── Calendar Notes ────────────────────────────────────────────────────────
    @GET("api/calendar_notes/{userId}")
    suspend fun getCalendarNotes(@Path("userId") userId: Int): Response<List<CalendarNote>>

    @POST("api/calendar_notes")
    suspend fun saveCalendarNote(@Body note: CalendarNote): Response<CalendarNote>

    @DELETE("api/calendar_notes/{id}")
    suspend fun deleteCalendarNote(@Path("id") id: Int): Response<GenericResponse>

    // ── AI Chat ───────────────────────────────────────────────────────────────
    @POST("api/ai-chat")
    suspend fun sendAiMessage(@Body request: AiChatRequest): Response<AiChatResponse>

    // ── Notifications ─────────────────────────────────────────────────────────
    @GET("api/notifications/{userId}")
    suspend fun getNotifications(@Path("userId") userId: Int): Response<List<AppNotification>>

    @PUT("api/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Int): Response<GenericResponse>

    @PUT("api/notifications/mark-all-read/{userId}")
    suspend fun markAllRead(@Path("userId") userId: Int): Response<GenericResponse>

    // ── Health Ping ───────────────────────────────────────────────────────────
    @GET("api/ping")
    suspend fun ping(): Response<Map<String, String>>
}
