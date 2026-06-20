package com.kisaanconnect

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import com.kisaanconnect.data.network.ApiClient
import com.kisaanconnect.utils.PrefsManager

class KisaanApp : Application(), ImageLoaderFactory {

    companion object {
        lateinit var instance: KisaanApp
            private set
    }

    lateinit var prefs: PrefsManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = PrefsManager(this)
        ApiClient.init(this)
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizePercent(0.02)
                    .build()
            }
            .memoryCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .crossfade(true)
            .build()
    }
}
