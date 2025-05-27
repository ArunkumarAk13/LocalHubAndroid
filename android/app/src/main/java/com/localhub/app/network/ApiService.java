package com.localhub.app.network;

import com.localhub.app.config.TwilioConfig.TwilioCredentials;
import retrofit2.Call;
import retrofit2.http.GET;
import retrofit2.http.Header;

public interface ApiService {
    @GET("api/twilio/config")
    Call<TwilioCredentials> getTwilioConfig(@Header("Authorization") String token);
} 