package com.localhub.app;

import android.content.Context;
import android.util.Log;
import android.os.Build;

public class DebugConfig {
    private static final String TAG = "LocalHub";

    public static void enableDebugLogging() {
        try {
            // Log device information
            Log.d(TAG, "Device model: " + Build.MODEL);
            Log.d(TAG, "Android version: " + Build.VERSION.RELEASE);
            Log.d(TAG, "Build fingerprint: " + Build.FINGERPRINT);
        } catch (Exception e) {
            Log.e(TAG, "Error enabling debug logging", e);
        }
    }
} 