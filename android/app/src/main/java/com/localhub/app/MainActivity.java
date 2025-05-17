package com.localhub.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "LocalHub";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging (only do this in development builds)
        // Capacitor will handle this for us, so we can remove this code
        // WebView.setWebContentsDebuggingEnabled(true);

        // Add logging for debugging
        Log.d(TAG, "LocalHub app started");

        // You can add more initialization here as needed
        // e.g., registerPlugin(MyCustomPlugin.class);
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "App resumed");
    }

    @Override
    public void onPause() {
        super.onPause();
        Log.d(TAG, "App paused");
    }
}
