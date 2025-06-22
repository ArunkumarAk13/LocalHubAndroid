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
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.CoroutineContext;
import kotlinx.coroutines.Dispatchers;
import androidx.annotation.NonNull;
import android.view.KeyEvent;
import android.app.NotificationManager;
import android.content.Context;

public class MainActivity extends BridgeActivity {
    private static final String ONESIGNAL_APP_ID = "43bbd100-da0d-47d0-bee3-986f6e393f03";
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Clear all notifications from notification bar when app starts
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancelAll();
            Log.d(TAG, "Cleared all notifications from notification bar on app start");
        }
        
        // Enable verbose OneSignal logging
        OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
        
        // Initialize OneSignal
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
        
        // Set up permission observer
        OneSignal.getNotifications().addPermissionObserver(new IPermissionObserver() {
            @Override
            public void onNotificationPermissionChange(boolean permission) {
                Log.d(TAG, "Notification permission changed: " + permission);
                if (permission) {
                    // Get the push token when permission is granted
                    String playerId = OneSignal.getUser().getPushSubscription().getId();
                    if (playerId != null) {
                        Log.d(TAG, "Got OneSignal player ID: " + playerId);
                        
                        // Store the token in SharedPreferences for later use
                        getSharedPreferences("OneSignal", MODE_PRIVATE)
                            .edit()
                            .putString("playerId", playerId)
                            .apply();
                        
                        // Send token to server via JavaScript
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
                    } else {
                        Log.e(TAG, "OneSignal player ID is null after permission granted");
                    }
                }
            }
        });
        
        // Set up notification click handler
        OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
            @Override
            public void onClick(INotificationClickEvent event) {
                Log.d(TAG, "Notification clicked: " + event.getNotification().getTitle());
            }
        });
        
        // Set up foreground notification lifecycle listener
        OneSignal.getNotifications().addForegroundLifecycleListener(new INotificationLifecycleListener() {
            @Override
            public void onWillDisplay(INotificationWillDisplayEvent event) {
                Log.d(TAG, "Notification will display in foreground: " + event.getNotification().getTitle());
            }
        });
        
        // Add JavaScript interface for external user ID
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new WebAppInterface(), "MainActivity");
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
    
    // JavaScript interface class
    private class WebAppInterface {
        @JavascriptInterface
        public void setExternalUserId(String userId) {
            if (userId != null && !userId.isEmpty()) {
                String secureUserId = "user_" + userId;
                Log.d(TAG, "Setting external user ID: " + secureUserId);
                OneSignal.login(secureUserId);
                
                // Request notification permission after login
                OneSignal.getNotifications().requestPermission(true, new Continuation<Boolean>() {
                    @Override
                    public void resumeWith(@NonNull Object result) {
                        Log.d(TAG, "Notification permission request result: " + result);
                        if ((Boolean) result) {
                            // Get and send the push token after permission is granted
                            String playerId = OneSignal.getUser().getPushSubscription().getId();
                            if (playerId != null) {
                                Log.d(TAG, "Got OneSignal player ID after login: " + playerId);
                                runOnUiThread(() -> {
                                    if (bridge != null && bridge.getWebView() != null) {
                                        String jsCode = String.format(
                                            "window.dispatchEvent(new CustomEvent('pushTokenReceived', { detail: '%s' }));",
                                            playerId
                                        );
                                        Log.d(TAG, "Executing JS after login: " + jsCode);
                                        bridge.getWebView().evaluateJavascript(jsCode, null);
                                    }
                                });
                            }
                        }
                    }

                    @Override
                    public CoroutineContext getContext() {
                        return Dispatchers.getMain();
                    }
                });
            } else {
                Log.d(TAG, "Logging out user from OneSignal");
                OneSignal.logout();
            }
        }
        
        @JavascriptInterface
        public void clearNotifications() {
            Log.d(TAG, "Clearing notifications from JavaScript interface");
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancelAll();
                Log.d(TAG, "Cleared all notifications from notification bar via JavaScript");
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "App resumed");
        
        // Clear all notifications from notification bar when app is opened
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancelAll();
            Log.d(TAG, "Cleared all notifications from notification bar");
        }
        
        // Check and send push token on resume
        String playerId = OneSignal.getUser().getPushSubscription().getId();
        if (playerId != null) {
            Log.d(TAG, "Got OneSignal player ID on resume: " + playerId);
            runOnUiThread(() -> {
                if (bridge != null && bridge.getWebView() != null) {
                    String jsCode = String.format(
                        "window.dispatchEvent(new CustomEvent('pushTokenReceived', { detail: '%s' }));",
                        playerId
                    );
                    Log.d(TAG, "Executing JS on resume: " + jsCode);
                    bridge.getWebView().evaluateJavascript(jsCode, null);
                }
            });
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        Log.d(TAG, "App paused");
    }
}
