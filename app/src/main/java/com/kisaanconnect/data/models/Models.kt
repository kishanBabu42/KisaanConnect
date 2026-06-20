package com.kisaanconnect.data.models

import androidx.annotation.DrawableRes
import com.google.gson.annotations.SerializedName
import java.util.UUID

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MODELS
// ─────────────────────────────────────────────────────────────────────────────

data class LoginRequest(
    val email: String,
    val password: String,
    val role: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,
    val mobile: String,
    val location: String,
    val role: String
)

data class OtpRequest(val email: String)
data class OtpVerifyRequest(val email: String, val otp: String)
data class ResetPasswordRequest(val email: String, val otp: String, val newPassword: String)

data class AuthResponse(
    val success: Boolean = false,
    val message: String? = null,
    val token: String? = null,
    val user: User? = null
)

data class GenericResponse(
    val success: Boolean = false,
    val message: String? = null
)

// ─────────────────────────────────────────────────────────────────────────────
// USER MODEL
// ─────────────────────────────────────────────────────────────────────────────

data class User(
    val id: Int = 0,
    val name: String = "",
    @SerializedName("full_name") val fullName: String? = null,
    val email: String = "",
    val mobile: String = "",
    val location: String = "",
    val role: String = "customer",
    val avatar: String? = null,
    @SerializedName("wallet_balance") val walletBalance: Double = 0.0,
    @SerializedName("created_at") val createdAt: String? = null
) {
    fun displayName(): String = fullName?.takeIf { it.isNotBlank() } ?: name.takeIf { it.isNotBlank() } ?: "User"
    fun isFarmer(): Boolean = role.lowercase() == "farmer"
    fun isCustomer(): Boolean = role.lowercase() == "customer"
}

data class WalletTransaction(
    val id: Int = 0,
    val amount: Double = 0.0,
    val type: String = "credit",   // credit | debit
    val description: String = "",
    @SerializedName("created_at") val createdAt: String? = null
) {
    fun isCredit() = type == "credit"
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT MODEL
// ─────────────────────────────────────────────────────────────────────────────

data class Product(
    val id: Int = 0,
    val name: String = "",
    val description: String? = null,
    val price: Double = 0.0,
    @SerializedName("market_price") val marketPrice: Double = 0.0,
    val quantity: Double = 0.0,
    val category: String = "",
    val location: String = "",
    val freshness: String = "",
    val status: String = "available",
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("farmer_id") val farmerId: Int = 0,
    @SerializedName("farmer_name") val farmerName: String = "",
    @SerializedName("delivery_days") val deliveryDays: Int = 2,
    @SerializedName("created_at") val createdAt: String? = null
) {
    fun formattedPrice(): String = "₹${String.format("%.0f", price)}/kg"
    fun savingsPercent(): Int {
        if (marketPrice <= 0 || price >= marketPrice) return 0
        return ((marketPrice - price) / marketPrice * 100).toInt()
    }
}

data class ProductsResponse(
    val products: List<Product>? = null,
    val total: Int = 0,
    val page: Int = 1,
    val pages: Int = 1
)

// ─────────────────────────────────────────────────────────────────────────────
// BID MODEL
// ─────────────────────────────────────────────────────────────────────────────

data class BidRequest(
    @SerializedName("product_id") val productId: Int,
    @SerializedName("customer_id") val customerId: Int,
    @SerializedName("bid_price") val bidPrice: Double,
    val quantity: Double,
    val message: String? = null
)

data class Bid(
    val id: Int = 0,
    @SerializedName("product_id") val productId: Int = 0,
    @SerializedName("product_name") val productName: String = "",
    @SerializedName("customer_id") val customerId: Int = 0,
    @SerializedName("customer_name") val customerName: String = "",
    @SerializedName("farmer_id") val farmerId: Int = 0,
    @SerializedName("bid_price") val bidPrice: Double = 0.0,
    val quantity: Double = 0.0,
    @SerializedName("total_amount") val totalAmount: Double = 0.0,
    val status: String = "pending",   // pending | accepted | rejected
    val message: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

// ─────────────────────────────────────────────────────────────────────────────
// ORDER MODEL
// ─────────────────────────────────────────────────────────────────────────────

data class Order(
    val id: Int = 0,
    @SerializedName("order_id") val orderId: String = "",
    @SerializedName("product_id") val productId: Int = 0,
    @SerializedName("product_name") val productName: String = "",
    @SerializedName("product_image") val productImage: String? = null,
    @SerializedName("customer_id") val customerId: Int = 0,
    @SerializedName("farmer_id") val farmerId: Int = 0,
    val quantity: Double = 0.0,
    val price: Double = 0.0,
    @SerializedName("total_amount") val totalAmount: Double = 0.0,
    val status: String = "pending",
    val address: String = "",
    @SerializedName("created_at") val createdAt: String? = null
) {
    fun formattedTotal(): String = "₹${String.format("%.0f", totalAmount)}"
    fun statusLabel(): String = when (status) {
        "pending" -> "Pending"
        "confirmed" -> "Confirmed"
        "shipped" -> "Shipped"
        "delivered" -> "Delivered"
        "cancelled" -> "Cancelled"
        else -> status.replaceFirstChar { it.uppercase() }
    }
    fun statusColor(): String = when (status) {
        "delivered" -> "#059669"
        "shipped"   -> "#3B82F6"
        "confirmed" -> "#8B5CF6"
        "cancelled" -> "#EF4444"
        else        -> "#F59E0B"
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────────────────────────────────────

data class CartItem(
    val product: Product,
    var quantity: Double = 1.0
) {
    fun subtotal(): Double = product.price * quantity
    fun formattedSubtotal(): String = "₹${String.format("%.0f", subtotal())}"
}

data class CartSummary(
    val items: List<CartItem>,
    val subtotal: Double,
    val deliveryFee: Double,
    val platformFee: Double,
    val total: Double
)

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

data class Category(
    val id: String,
    val name: String,
    @DrawableRes val iconRes: Int,
    val colorHex: String
)

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

data class AppNotification(
    val id: Int = 0,
    @SerializedName("user_id") val userId: Int = 0,
    val title: String = "",
    val body: String = "",
    val type: String = "general",
    @SerializedName("is_read") val isRead: Boolean = false,
    @SerializedName("created_at") val createdAt: String? = null
)

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT
// ─────────────────────────────────────────────────────────────────────────────

data class AiChatRequest(
    val message: String,
    val role: String
)

data class AiChatResponse(
    val reply: String? = null,
    val success: Boolean = false
)

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val content: String,
    val isFromUser: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────────────────────────────────────────

data class CalendarNote(
    val id: Int = 0,
    @SerializedName("user_id") val userId: Int = 0,
    val date: String = "",
    val title: String = "",
    val note: String = "",
    val type: String = "task",
    @SerializedName("created_at") val createdAt: String? = null
)
