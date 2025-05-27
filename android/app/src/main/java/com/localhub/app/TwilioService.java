package com.localhub.app;

import android.content.Context;
import android.util.Log;
import com.twilio.Twilio;
import com.twilio.rest.verify.v2.service.Verification;
import com.twilio.rest.verify.v2.service.VerificationCheck;
import com.twilio.exception.ApiException;
import com.localhub.app.config.TwilioConfig;

public class TwilioService {
    private static final String TAG = "TwilioService";
    private static TwilioService instance;
    private Context context;
    private boolean isInitialized = false;

    private TwilioService(Context context) {
        this.context = context.getApplicationContext();
        initializeTwilio();
    }

    private void initializeTwilio() {
        TwilioConfig.initialize(context);
        // Wait for credentials to be loaded
        new Thread(() -> {
            int attempts = 0;
            while (TwilioConfig.getAccountSid() == null && attempts < 10) {
                try {
                    Thread.sleep(1000);
                    attempts++;
                } catch (InterruptedException e) {
                    Log.e(TAG, "Error waiting for Twilio credentials: " + e.getMessage());
                }
            }
            if (TwilioConfig.getAccountSid() != null) {
                Twilio.init(TwilioConfig.getAccountSid(), TwilioConfig.getAuthToken());
                isInitialized = true;
                Log.d(TAG, "Twilio initialized successfully");
            } else {
                Log.e(TAG, "Failed to initialize Twilio: credentials not loaded");
            }
        }).start();
    }

    public static synchronized TwilioService getInstance(Context context) {
        if (instance == null) {
            instance = new TwilioService(context);
        }
        return instance;
    }

    private String formatPhoneNumber(String phoneNumber) {
        // Remove any spaces or special characters
        phoneNumber = phoneNumber.replaceAll("[^0-9+]", "");
        
        // If number doesn't start with +, add the default country code
        if (!phoneNumber.startsWith("+")) {
            phoneNumber = TwilioConfig.DEFAULT_COUNTRY_CODE + phoneNumber;
        }
        
        return phoneNumber;
    }

    public void sendVerificationCode(String phoneNumber, final TwilioCallback callback) {
        if (!isInitialized) {
            callback.onError(new Exception("Twilio service not initialized"));
            return;
        }

        try {
            // Format the phone number
            String formattedNumber = formatPhoneNumber(phoneNumber);
            Log.d(TAG, "Sending verification code to: " + formattedNumber);

            Verification verification = Verification.creator(TwilioConfig.getVerifyServiceSid(), formattedNumber, "sms")
                .create();
            
            if (verification.getStatus().equals("pending")) {
                callback.onSuccess("Verification code sent successfully to " + formattedNumber);
            } else {
                callback.onError(new Exception("Failed to send verification code"));
            }
        } catch (ApiException e) {
            Log.e(TAG, "Error sending verification code: " + e.getMessage());
            callback.onError(e);
        }
    }

    public void verifyCode(String phoneNumber, String code, final TwilioCallback callback) {
        if (!isInitialized) {
            callback.onError(new Exception("Twilio service not initialized"));
            return;
        }

        try {
            // Format the phone number
            String formattedNumber = formatPhoneNumber(phoneNumber);
            Log.d(TAG, "Verifying code for: " + formattedNumber);

            VerificationCheck verificationCheck = VerificationCheck.creator(TwilioConfig.getVerifyServiceSid())
                .setTo(formattedNumber)
                .setCode(code)
                .create();

            if (verificationCheck.getStatus().equals("approved")) {
                callback.onSuccess("Phone number verified successfully");
            } else {
                callback.onError(new Exception("Invalid verification code"));
            }
        } catch (ApiException e) {
            Log.e(TAG, "Error verifying code: " + e.getMessage());
            callback.onError(e);
        }
    }

    public interface TwilioCallback {
        void onSuccess(String message);
        void onError(Exception e);
    }
} 