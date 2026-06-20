package com.kisaanconnect.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.view.View
import android.widget.ImageView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LiveData
import coil.load
import coil.transform.CircleCropTransformation
import coil.transform.RoundedCornersTransformation
import com.google.android.material.snackbar.Snackbar
import com.kisaanconnect.R
import retrofit2.Response
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

// ── Network ───────────────────────────────────────────────────────────────────
fun Context.isNetworkAvailable(): Boolean {
    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}

// ── Safe API call wrapper ─────────────────────────────────────────────────────
suspend fun <T> safeApiCall(block: suspend () -> Response<T>): Resource<T> {
    return try {
        val response = block()
        if (response.isSuccessful) {
            val body = response.body()
            if (body != null) Resource.Success(body)
            else Resource.Error("Empty response body", response.code())
        } else {
            val errorMsg = response.errorBody()?.string() ?: "Request failed"
            Resource.Error(errorMsg, response.code())
        }
    } catch (e: java.net.UnknownHostException) {
        Resource.Error("No internet connection. Please check your network.")
    } catch (e: java.net.SocketTimeoutException) {
        Resource.Error("Connection timed out. Please try again.")
    } catch (e: Exception) {
        Resource.Error(e.message ?: "Unexpected error occurred")
    }
}

// ── View Extensions ──────────────────────────────────────────────────────────
fun View.show() { visibility = View.VISIBLE }
fun View.hide() { visibility = View.GONE }
fun View.invisible() { visibility = View.INVISIBLE }
fun View.showIf(condition: Boolean) { visibility = if (condition) View.VISIBLE else View.GONE }

fun View.setOnSingleClickListener(delay: Long = 600L, action: () -> Unit) {
    var lastClickTime = 0L
    setOnClickListener {
        val now = System.currentTimeMillis()
        if (now - lastClickTime >= delay) {
            lastClickTime = now
            action()
        }
    }
}

// ── Toast / Snackbar ──────────────────────────────────────────────────────────
fun Context.toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
fun Context.toastLong(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
fun Fragment.toast(msg: String) = requireContext().toast(msg)

fun View.snack(msg: String, duration: Int = Snackbar.LENGTH_SHORT) =
    Snackbar.make(this, msg, duration).show()

fun View.snackAction(msg: String, actionLabel: String, action: () -> Unit) {
    Snackbar.make(this, msg, Snackbar.LENGTH_LONG)
        .setAction(actionLabel) { action() }
        .show()
}

// ── Image Loading ─────────────────────────────────────────────────────────────
fun ImageView.loadUrl(url: String?, placeholder: Int = R.drawable.logo) {
    load(url) {
        placeholder(placeholder)
        error(placeholder)
        crossfade(true)
    }
}

fun ImageView.loadCircle(url: String?, placeholder: Int = R.drawable.logo) {
    load(url) {
        placeholder(placeholder)
        error(placeholder)
        transformations(CircleCropTransformation())
        crossfade(true)
    }
}

fun ImageView.loadRounded(url: String?, radius: Float = 16f, placeholder: Int = R.drawable.logo) {
    load(url) {
        placeholder(placeholder)
        error(placeholder)
        transformations(RoundedCornersTransformation(radius))
        crossfade(true)
    }
}

// ── String Extensions ─────────────────────────────────────────────────────────
fun String.isValidEmail(): Boolean =
    android.util.Patterns.EMAIL_ADDRESS.matcher(this).matches()

fun String.isValidMobile(): Boolean =
    this.length == 10 && this.all { it.isDigit() } && this[0] in '6'..'9'

fun String.isValidPassword(): Boolean = this.length >= 6

fun String.capitalizeWords(): String =
    split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

// ── Number Formatting ─────────────────────────────────────────────────────────
fun Double.toRupees(): String = "₹${String.format("%.0f", this)}"
fun Double.toRupeesWithDecimal(): String = "₹${String.format("%.2f", this)}"
fun Int.toFormattedCount(): String = NumberFormat.getNumberInstance(Locale("en", "IN")).format(this)

// ── Date / Time ───────────────────────────────────────────────────────────────
fun String?.toDisplayDate(): String {
    if (this.isNullOrBlank()) return "N/A"
    return try {
        val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val output = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        output.format(input.parse(this) ?: return this)
    } catch (e: Exception) {
        try {
            val input2 = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val output = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
            output.format(input2.parse(this) ?: return this)
        } catch (e2: Exception) { this }
    }
}

fun String?.toRelativeTime(): String {
    if (this.isNullOrBlank()) return "Just now"
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val date = sdf.parse(this) ?: return this
        val diff = System.currentTimeMillis() - date.time
        when {
            diff < 60_000 -> "Just now"
            diff < 3_600_000 -> "${diff / 60_000}m ago"
            diff < 86_400_000 -> "${diff / 3_600_000}h ago"
            diff < 604_800_000 -> "${diff / 86_400_000}d ago"
            else -> date.let {
                SimpleDateFormat("dd MMM", Locale.getDefault()).format(it)
            }
        }
    } catch (e: Exception) { this }
}

fun getGreeting(): String {
    return when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11 -> "Good Morning"
        in 12..16 -> "Good Afternoon"
        in 17..20 -> "Good Evening"
        else -> "Good Night"
    }
}

// ── LiveData ──────────────────────────────────────────────────────────────────
fun <T> LiveData<T>.observeOnce(owner: LifecycleOwner, block: (T) -> Unit) {
    observe(owner) { value ->
        block(value)
        removeObservers(owner)
    }
}
