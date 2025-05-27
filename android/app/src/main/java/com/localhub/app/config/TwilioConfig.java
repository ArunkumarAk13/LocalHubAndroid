package com.localhub.app.config;

import android.content.Context;
import android.util.Log;
import com.localhub.app.network.ApiService;
import com.localhub.app.network.RetrofitClient;

public class TwilioConfig {
    private static final String TAG = "TwilioConfig";
    private static String accountSid;
    private static String authToken;
    private static String verifyServiceSid;
    public static final String DEFAULT_COUNTRY_CODE = "+91";
    private static final String BASE_URL = "https://your-render-backend-url.onrender.com"; // Replace with your Render backend URL

    public static void initialize(Context context) {
        ApiService apiService = RetrofitClient.getClient(BASE_URL).create(ApiService.class);
        
        // Fetch Twilio credentials from your backend
        apiService.getTwilioConfig().enqueue(new retrofit2.Callback<TwilioCredentials>() {
            @Override
            public void onResponse(retrofit2.Call<TwilioCredentials> call, retrofit2.Response<TwilioCredentials> response) {
                if (response.isSuccessful() && response.body() != null) {
                    TwilioCredentials credentials = response.body();
                    accountSid = credentials.getAccountSid();
                    authToken = credentials.getAuthToken();
                    verifyServiceSid = credentials.getVerifyServiceSid();
                    Log.d(TAG, "Twilio credentials loaded successfully");
                } else {
                    Log.e(TAG, "Failed to load Twilio credentials: " + response.message());
                }
            }

            @Override
            public void onFailure(retrofit2.Call<TwilioCredentials> call, Throwable t) {
                Log.e(TAG, "Error loading Twilio credentials: " + t.getMessage());
            }
        });
    }

    public static String getAccountSid() {
        return accountSid;
    }

    public static String getAuthToken() {
        return authToken;
    }

    public static String getVerifyServiceSid() {
        return verifyServiceSid;
    }

    // Data class for Twilio credentials
    public static class TwilioCredentials {
        private String accountSid;
        private String authToken;
        private String verifyServiceSid;

        public String getAccountSid() {
            return accountSid;
        }

        public String getAuthToken() {
            return authToken;
        }

        public String getVerifyServiceSid() {
            return verifyServiceSid;
        }
    }
} 