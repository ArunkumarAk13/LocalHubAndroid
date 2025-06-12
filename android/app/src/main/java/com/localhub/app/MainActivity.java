package com.localhub.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.INotificationClickListener;
import com.onesignal.notifications.INotificationClickEvent;
import com.onesignal.notifications.INotificationLifecycleListener;
import com.onesignal.notifications.INotificationWillDisplayEvent;
import com.onesignal.notifications.IPermissionObserver;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.CoroutineContext;
import kotlinx.coroutines.Dispatchers;
import androidx.annotation.NonNull;
import android.view.KeyEvent;
import android.os.Build;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends BridgeActivity {
    private static final String ONESIGNAL_APP_ID = "43bbd100-da0d-47d0-bee3-986f6e393f03";
    private static final String TAG = "MainActivity";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize WebView with security settings
        if (bridge != null && bridge.getWebView() != null) {
            webView = bridge.getWebView();
            setupWebView();
        }
        
        // Enable verbose OneSignal logging only in debug
        if (BuildConfig.DEBUG) {
            OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
        }
        
        // Initialize OneSignal
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
        
        // Clear all notifications when app is opened
        OneSignal.getNotifications().clearAll();
        
        // Set up permission observer
        setupOneSignal();
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        
        // Enable JavaScript
        settings.setJavaScriptEnabled(true);
        
        // Enable DOM storage
        settings.setDomStorageEnabled(true);
        
        // Enable database storage
        settings.setDatabaseEnabled(true);
        
        // Enable application cache
        settings.setAppCacheEnabled(true);
        
        // Set cache mode
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // Enable hardware acceleration
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
        
        // Set WebViewClient with security measures
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Handle SSL errors securely
                if (BuildConfig.DEBUG) {
                    handler.proceed(); // Only in debug mode
                } else {
                    handler.cancel(); // In production, cancel on SSL errors
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Handle URL loading securely
                String url = request.getUrl().toString();
                if (url.startsWith("https://localhub-app.vercel.app")) {
                    view.loadUrl(url);
                    return true;
                }
                return false;
            }
        });
    }

    private void setupOneSignal() {
        // Set up permission observer
        OneSignal.getNotifications().addPermissionObserver(new IPermissionObserver() {
            @Override
            public void onNotificationPermissionChange(boolean permission) {
                Log.d(TAG, "Notification permission changed: " + permission);
                if (permission) {
                    handleNotificationPermissionGranted();
                }
            }
        });
        
        // Set up notification click handler
        OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
            @Override
            public void onClick(INotificationClickEvent event) {
                Log.d(TAG, "Notification clicked: " + event.getNotification().getTitle());
                handleNotificationClick(event);
            }
        });
        
        // Set up foreground notification lifecycle listener
        OneSignal.getNotifications().addForegroundLifecycleListener(new INotificationLifecycleListener() {
            @Override
            public void onWillDisplay(INotificationWillDisplayEvent event) {
                Log.d(TAG, "Notification will display in foreground: " + event.getNotification().getTitle());
            }
        });
    }

    private void handleNotificationPermissionGranted() {
        String playerId = OneSignal.getUser().getPushSubscription().getId();
        if (playerId != null) {
            Log.d(TAG, "Got OneSignal player ID: " + playerId);
            
            // Store the token securely
            getSharedPreferences("OneSignal", MODE_PRIVATE)
                .edit()
                .putString("playerId", playerId)
                .apply();
            
            // Send token to server via JavaScript
            sendTokenToServer(playerId);
        }
    }

    private void sendTokenToServer(String playerId) {
        runOnUiThread(() -> {
            if (bridge != null && bridge.getWebView() != null) {
                String jsCode = String.format(
                    "window.dispatchEvent(new CustomEvent('pushTokenReceived', { detail: '%s' }));",
                    playerId
                );
                Log.d(TAG, "Executing JS: " + jsCode);
                bridge.getWebView().evaluateJavascript(jsCode, null);
            }
        });
    }

    private void handleNotificationClick(INotificationClickEvent event) {
        // Handle notification click based on type
        String type = event.getNotification().getAdditionalData().optString("type", "");
        String targetId = event.getNotification().getAdditionalData().optString("target_id", "");
        
        if (type.equals("chat")) {
            // Handle chat notification click
            navigateToChat(targetId);
        } else {
            // Handle other notification types
            navigateToNotification(targetId);
        }
    }

    private void navigateToChat(String chatId) {
        if (bridge != null && bridge.getWebView() != null) {
            String jsCode = String.format(
                "window.location.href = '/chat/%s';",
                chatId
            );
            bridge.getWebView().evaluateJavascript(jsCode, null);
        }
    }

    private void navigateToNotification(String targetId) {
        if (bridge != null && bridge.getWebView() != null) {
            String jsCode = String.format(
                "window.location.href = '/notifications';"
            );
            bridge.getWebView().evaluateJavascript(jsCode, null);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (bridge != null && bridge.getWebView() != null) {
                // Execute JavaScript to handle back navigation
                String jsCode = "if (window.history.length > 1) { window.history.back(); } else { window.dispatchEvent(new CustomEvent('exitApp')); }";
                bridge.getWebView().evaluateJavascript(jsCode, null);
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "App resumed");
        
        // Check and send push token on resume
        String playerId = OneSignal.getUser().getPushSubscription().getId();
        if (playerId != null) {
            sendTokenToServer(playerId);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        Log.d(TAG, "App paused");
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
