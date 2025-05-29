package com.localhub.app;

import android.content.Context;
import android.util.Log;
import com.onesignal.OneSignal;
import com.onesignal.OSNotificationOpenedResult;
import com.onesignal.OSNotificationReceivedEvent;
import com.onesignal.OneSignal.OSNotificationWillShowInForegroundHandler;
import com.onesignal.OneSignal.OSNotificationOpenedHandler;

public class OneSignalService {
    private static final String TAG = "OneSignalService";
    private static OneSignalService instance;
    private Context context;
    private boolean isInitialized = false;

    private OneSignalService(Context context) {
        this.context = context.getApplicationContext();
        initializeOneSignal();
    }

    private void initializeOneSignal() {
        // Initialize OneSignal
        OneSignal.initWithContext(context);
        OneSignal.setAppId("43bbd100-da0d-47d0-bee3-986f6e393f03");

        // Set notification opened handler
        OneSignal.setNotificationOpenedHandler(new OSNotificationOpenedHandler() {
            @Override
            public void notificationOpened(OSNotificationOpenedResult result) {
                // Handle notification opened
                String notificationType = result.getNotification().getAdditionalData().optString("type", "");
                String targetId = result.getNotification().getAdditionalData().optString("target_id", "");
                
                // Navigate based on notification type
                if (notificationType.equals("chat")) {
                    // Navigate to chat screen
                    navigateToChat(targetId);
                } else if (notificationType.equals("notification")) {
                    // Navigate to notifications screen
                    navigateToNotifications();
                }
            }
        });

        // Set foreground notification handler
        OneSignal.setNotificationWillShowInForegroundHandler(new OSNotificationWillShowInForegroundHandler() {
            @Override
            public void notificationWillShowInForeground(OSNotificationReceivedEvent notificationReceivedEvent) {
                // Show notification even when app is in foreground
                notificationReceivedEvent.complete(notificationReceivedEvent.getNotification());
            }
        });

        isInitialized = true;
        Log.d(TAG, "OneSignal initialized successfully");
    }

    public static synchronized OneSignalService getInstance(Context context) {
        if (instance == null) {
            instance = new OneSignalService(context);
        }
        return instance;
    }

    private void navigateToChat(String chatId) {
        // Implement navigation to chat screen
        // This will depend on your app's navigation system
    }

    private void navigateToNotifications() {
        // Implement navigation to notifications screen
        // This will depend on your app's navigation system
    }

    public void sendExternalUserId(String userId) {
        if (!isInitialized) {
            Log.e(TAG, "OneSignal not initialized");
            return;
        }
        OneSignal.setExternalUserId(userId);
    }

    public void removeExternalUserId() {
        if (!isInitialized) {
            Log.e(TAG, "OneSignal not initialized");
            return;
        }
        OneSignal.removeExternalUserId();
    }
} 