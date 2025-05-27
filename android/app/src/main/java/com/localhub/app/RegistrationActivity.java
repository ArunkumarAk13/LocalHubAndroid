package com.localhub.app;

import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.localhub.app.network.ApiService;
import com.localhub.app.network.RetrofitClient;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegistrationActivity extends AppCompatActivity {
    private static final String TAG = "RegistrationActivity";
    private EditText phoneInput;
    private EditText otpInput;
    private Button sendOtpButton;
    private Button verifyOtpButton;
    private ProgressBar progressBar;
    private TwilioService twilioService;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_registration);

        // Initialize views
        phoneInput = findViewById(R.id.phoneInput);
        otpInput = findViewById(R.id.otpInput);
        sendOtpButton = findViewById(R.id.sendOtpButton);
        verifyOtpButton = findViewById(R.id.verifyOtpButton);
        progressBar = findViewById(R.id.progressBar);

        // Initialize Twilio service
        twilioService = TwilioService.getInstance(this);

        // Set up click listeners
        sendOtpButton.setOnClickListener(v -> sendOTP());
        verifyOtpButton.setOnClickListener(v -> verifyOTP());

        // Initially disable OTP input and verify button
        otpInput.setEnabled(false);
        verifyOtpButton.setEnabled(false);
    }

    private void sendOTP() {
        String phoneNumber = phoneInput.getText().toString().trim();
        
        if (phoneNumber.isEmpty()) {
            Toast.makeText(this, "Please enter a phone number", Toast.LENGTH_SHORT).show();
            return;
        }

        // Show progress
        setLoading(true);

        twilioService.sendVerificationCode(phoneNumber, new TwilioService.TwilioCallback() {
            @Override
            public void onSuccess(String message) {
                runOnUiThread(() -> {
                    setLoading(false);
                    Toast.makeText(RegistrationActivity.this, message, Toast.LENGTH_SHORT).show();
                    // Enable OTP input and verify button
                    otpInput.setEnabled(true);
                    verifyOtpButton.setEnabled(true);
                });
            }

            @Override
            public void onError(Exception e) {
                runOnUiThread(() -> {
                    setLoading(false);
                    Toast.makeText(RegistrationActivity.this, 
                        "Error: " + e.getMessage(), 
                        Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void verifyOTP() {
        String phoneNumber = phoneInput.getText().toString().trim();
        String otp = otpInput.getText().toString().trim();
        
        if (otp.isEmpty()) {
            Toast.makeText(this, "Please enter the OTP", Toast.LENGTH_SHORT).show();
            return;
        }

        // Show progress
        setLoading(true);

        twilioService.verifyCode(phoneNumber, otp, new TwilioService.TwilioCallback() {
            @Override
            public void onSuccess(String message) {
                runOnUiThread(() -> {
                    setLoading(false);
                    Toast.makeText(RegistrationActivity.this, message, Toast.LENGTH_SHORT).show();
                    // Proceed with registration
                    completeRegistration(phoneNumber);
                });
            }

            @Override
            public void onError(Exception e) {
                runOnUiThread(() -> {
                    setLoading(false);
                    Toast.makeText(RegistrationActivity.this, 
                        "Error: " + e.getMessage(), 
                        Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private void completeRegistration(String phoneNumber) {
        // Here you can proceed with the rest of your registration process
        // For example, navigate to the main activity
        // Intent intent = new Intent(this, MainActivity.class);
        // startActivity(intent);
        // finish();
    }

    private void setLoading(boolean isLoading) {
        progressBar.setVisibility(isLoading ? View.VISIBLE : View.GONE);
        sendOtpButton.setEnabled(!isLoading);
        verifyOtpButton.setEnabled(!isLoading);
        phoneInput.setEnabled(!isLoading);
        otpInput.setEnabled(!isLoading);
    }
} 