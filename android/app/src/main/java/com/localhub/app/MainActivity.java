package com.localhub.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "LocalHub";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Add logging for debugging
        Log.d(TAG, "LocalHub app started");

        // Enable debug logging
        DebugConfig.enableDebugLogging();
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
