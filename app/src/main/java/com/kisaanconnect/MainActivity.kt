package com.kisaanconnect

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var googleSignInClient: GoogleSignInClient
    private lateinit var googleSignInLauncher: ActivityResultLauncher<Intent>

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Configure Google Sign-In
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            // The Web Client ID from Google Cloud Console (shared with web version)
            .requestIdToken("988035936319-57la08glkrlbasj5e1bp1mrm61l17bps.apps.googleusercontent.com")
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        // 2. Prepare Result Launcher
        googleSignInLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)
                handleSignInResult(account)
            } catch (e: ApiException) {
                Log.e("GoogleSignIn", "Sign-in failed: ${e.statusCode}")
                sendErrorToJs("Google Sign-In failed: ${e.message}")
            }
        }

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.webViewClient = WebViewClient()

        // Bind the Android platform interface to WebView JavaScript
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun getServerUrl(): String {
                val cleanUrl = ApiClient.BASE_URL.trim().removeSuffix("/")
                return "$cleanUrl/api"
            }

            @JavascriptInterface
            fun launchGoogleSignIn() {
                runOnUiThread {
                    // Sign out first to always show the account picker
                    googleSignInClient.signOut().addOnCompleteListener {
                        googleSignInLauncher.launch(googleSignInClient.signInIntent)
                    }
                }
            }
        }, "Android")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun handleSignInResult(account: GoogleSignInAccount?) {
        if (account != null) {
            val userJson = JSONObject().apply {
                put("email", account.email)
                put("name", account.displayName)
                put("picture", account.photoUrl?.toString())
                put("idToken", account.idToken)
                put("googleId", account.id)
            }
            
            // Pass the data back to the WebView JavaScript
            val script = "javascript:onNativeGoogleSignInSuccess(${userJson})"
            webView.evaluateJavascript(script, null)
        }
    }

    private fun sendErrorToJs(message: String) {
        val script = "javascript:onNativeGoogleSignInError('$message')"
        webView.evaluateJavascript(script, null)
    }
}
