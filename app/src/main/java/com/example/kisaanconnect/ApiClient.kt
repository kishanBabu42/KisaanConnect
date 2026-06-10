package com.example.kisaanconnect

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClient {
    // ✅ UPDATED: Current Wi-Fi IP for this network (10.117.116.11)
    // If the server moves to a different IP, update this value and rebuild.
    // The WebView kisaan-network.js auto-discovers the IP dynamically,
    // but Retrofit (used for native API calls) needs a fixed base URL.
    const val BASE_URL = "http://10.117.116.11:3001/"

    private var retrofit: Retrofit? = null

    fun getClient(): Retrofit {
        if (retrofit == null) {
            retrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!
    }
}
