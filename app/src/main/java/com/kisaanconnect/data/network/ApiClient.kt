package com.kisaanconnect.data.network

import android.content.Context
import com.google.gson.GsonBuilder
import com.google.gson.JsonDeserializer
import com.kisaanconnect.BuildConfig
import com.kisaanconnect.data.models.AuthResponse
import com.kisaanconnect.data.models.User
import com.kisaanconnect.utils.PrefsManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private const val CONNECT_TIMEOUT = 60L
    private const val READ_TIMEOUT = 60L
    private const val WRITE_TIMEOUT = 60L

    private lateinit var prefs: PrefsManager
    private var _service: ApiService? = null

    val service: ApiService
        get() = _service ?: throw IllegalStateException("ApiClient not initialized. Call init() first.")

    fun init(context: Context) {
        prefs = PrefsManager(context)
        _service = buildService()
    }

    private fun buildService(): ApiService {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG)
                HttpLoggingInterceptor.Level.BODY
            else
                HttpLoggingInterceptor.Level.NONE
        }

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = prefs.authToken
            val request = if (!token.isNullOrBlank()) {
                original.newBuilder()
                    .header("Authorization", "Bearer $token")
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .build()
            } else {
                original.newBuilder()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .build()
            }
            chain.proceed(request)
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .retryOnConnectionFailure(true)
            .build()

        val gson = GsonBuilder()
            .registerTypeAdapter(AuthResponse::class.java, JsonDeserializer<AuthResponse> { json, _, context ->
                try {
                    val jsonObject = json.asJsonObject
                    if (jsonObject.has("success")) {
                        val success = jsonObject.get("success").asBoolean
                        val message = if (jsonObject.has("message") && !jsonObject.get("message").isJsonNull) jsonObject.get("message").asString else null
                        val token = if (jsonObject.has("token") && !jsonObject.get("token").isJsonNull) jsonObject.get("token").asString else null
                        val user = if (jsonObject.has("user") && !jsonObject.get("user").isJsonNull) {
                            context.deserialize<User>(jsonObject.get("user"), User::class.java)
                        } else {
                            null
                        }
                        AuthResponse(success, message, token, user)
                    } else if (jsonObject.has("id") || jsonObject.has("email")) {
                        val user = context.deserialize<User>(json, User::class.java)
                        val token = "session_token_" + user.id
                        AuthResponse(success = true, message = "Success", token = token, user = user)
                    } else {
                        AuthResponse()
                    }
                } catch (e: Exception) {
                    AuthResponse(success = false, message = e.message)
                }
            })
            .create()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(ApiService::class.java)
    }
}
