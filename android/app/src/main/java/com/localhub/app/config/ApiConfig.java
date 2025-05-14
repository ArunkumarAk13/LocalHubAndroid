package com.localhub.app.config;

public class ApiConfig {
    // Development API URL
    private static final String DEV_API_URL = "http://10.0.2.2:5000"; // Android emulator localhost
    
    // Production API URL
    private static final String PROD_API_URL = "https://localhub-backend.onrender.com";
    
    // Current API URL based on build type
    public static final String API_URL = BuildConfig.DEBUG ? DEV_API_URL : PROD_API_URL;
    
    // API Endpoints
    public static final String AUTH_ENDPOINT = API_URL + "/api/auth";
    public static final String POSTS_ENDPOINT = API_URL + "/api/posts";
    public static final String USERS_ENDPOINT = API_URL + "/api/users";
    public static final String RATINGS_ENDPOINT = API_URL + "/api/ratings";
    public static final String CHAT_ENDPOINT = API_URL + "/api/chats";
    public static final String UPLOAD_ENDPOINT = API_URL + "/api/upload";
    
    // API Headers
    public static final String CONTENT_TYPE = "Content-Type";
    public static final String APPLICATION_JSON = "application/json";
    public static final String AUTHORIZATION = "Authorization";
    public static final String BEARER = "Bearer ";
    
    // API Timeouts
    public static final int CONNECT_TIMEOUT = 30; // seconds
    public static final int READ_TIMEOUT = 30; // seconds
    public static final int WRITE_TIMEOUT = 30; // seconds
} 