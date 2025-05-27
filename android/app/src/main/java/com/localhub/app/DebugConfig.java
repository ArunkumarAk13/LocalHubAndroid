package com.localhub.app;

import android.util.Log;

public class DebugConfig {
    private static final String TAG = "LocalHubDebug";

    public static void enableDebugLogging() {
        // Enable Firebase debug logging
        System.setProperty("debug.firebase.analytics.app", "com.localhub.app");
        
        // Enable Play Integrity debug logging
        System.setProperty("debug.play.integrity", "true");
        
        // Enable Firebase Auth debug logging
        System.setProperty("debug.firebase.auth", "true");
        
        Log.d(TAG, "Debug logging enabled");
    }
} 