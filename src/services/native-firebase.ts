import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';

/**
 * Check if we should use native authentication
 * Only use native on Android with the plugin installed
 */
export const shouldUseNativeAuth = () => {
  return Capacitor.getPlatform() === 'android';
};

// Store verification ID for the native flow
let nativeVerificationId = '';

// Create a promise for the verification ID that can be resolved when the event is received
let verificationIdPromise: Promise<string> | null = null;
let verificationIdResolver: ((value: string) => void) | null = null;

/**
 * Configure Firebase Authentication before using it
 */
export const initializeFirebaseAuth = async () => {
  try {
    // Configure reCAPTCHA verifier settings - This is important for Android
    await FirebaseAuthentication.setLanguageCode({ languageCode: 'en' });
    
    // For Android, configure to use invisible reCAPTCHA
    if (Capacitor.getPlatform() === 'android') {
      await FirebaseAuthentication.useAppLanguage();
      console.log("[Native Firebase] Initialized Firebase Auth with app language");
    }
    
    return true;
  } catch (error) {
    console.error("[Native Firebase] Failed to initialize Firebase Auth:", error);
    return false;
  }
};

/**
 * Send OTP via native Firebase SDK
 * The Capacitor Firebase Authentication plugin uses events to handle the phone verification process
 */
export const sendNativeOTP = async (phoneNumber: string) => {
  try {
    console.log("[Native Firebase] Sending OTP to:", phoneNumber);
    
    // Initialize Firebase Auth configurations
    await initializeFirebaseAuth();
    
    // Format phone number
    const formattedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+91${phoneNumber}`;
    
    // Remove any existing listeners to avoid duplicates
    await FirebaseAuthentication.removeAllListeners();
    
    // Create a new promise for verification ID
    verificationIdPromise = new Promise((resolve) => {
      verificationIdResolver = resolve;
    });
    
    // Set up listener for phoneCodeSent event before initiating phone auth
    await FirebaseAuthentication.addListener('phoneCodeSent', event => {
      console.log('[Native Firebase] Phone code sent event received:', event);
      
      if (event?.verificationId) {
        nativeVerificationId = event.verificationId;
        console.log('[Native Firebase] Saved verification ID:', nativeVerificationId);
        
        // Resolve the verificationId promise
        if (verificationIdResolver) {
          verificationIdResolver(nativeVerificationId);
        }
      } else {
        console.error('[Native Firebase] No verificationId in phoneCodeSent event:', event);
      }
    });
    
    // Set up listener for verification failure
    await FirebaseAuthentication.addListener('phoneVerificationFailed', error => {
      console.error('[Native Firebase] Phone verification failed:', error);
    });
    
    // Set up listener for automatic verification (on some Android devices)
    await FirebaseAuthentication.addListener('phoneVerificationCompleted', result => {
      console.log('[Native Firebase] Phone verification completed automatically:', result);
    });
    
    // Initiate the SMS verification process with forceRecaptcha=false for Android
    console.log("[Native Firebase] Calling signInWithPhoneNumber:", formattedPhone);
    await FirebaseAuthentication.signInWithPhoneNumber({
      phoneNumber: formattedPhone
    });
    console.log("[Native Firebase] signInWithPhoneNumber called successfully");
    
    // Wait for the verification ID to be set (with a timeout)
    try {
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout waiting for verification ID')), 30000);
      });
      
      // Wait for either the verification ID or the timeout
      const verificationId = await Promise.race([verificationIdPromise, timeoutPromise]);
      console.log("[Native Firebase] Verification ID obtained:", verificationId);
      
      return {
        success: true
      };
    } catch (timeoutError) {
      console.error("[Native Firebase] Timeout waiting for verification ID:", timeoutError);
      return {
        success: false,
        message: "SMS verification timed out. Please try again."
      };
    }
  } catch (error: any) {
    console.error("[Native Firebase] Error sending OTP:", error);
    return {
      success: false,
      message: error.message || "Failed to send verification code"
    };
  }
};

/**
 * Verify OTP via native Firebase SDK
 */
export const verifyNativeOTP = async (otp: string) => {
  try {
    console.log("[Native Firebase] Verifying OTP with code:", otp);
    console.log("[Native Firebase] Using verification ID:", nativeVerificationId);
    
    if (!nativeVerificationId) {
      console.error("[Native Firebase] No verification ID available");
      return {
        success: false,
        message: "Verification ID not found. Please request a new code."
      };
    }
    
    // Use the stored verification ID with the OTP code
    console.log("[Native Firebase] Calling confirmVerificationCode with:", { 
      verificationId: nativeVerificationId, 
      verificationCode: otp 
    });
    
    const result = await FirebaseAuthentication.confirmVerificationCode({
      verificationId: nativeVerificationId,
      verificationCode: otp
    });
    
    console.log("[Native Firebase] OTP verified successfully:", result);
    
    // Clean up listeners once verification is complete
    await FirebaseAuthentication.removeAllListeners();
    
    return {
      success: true,
      user: result.user
    };
  } catch (error: any) {
    console.error("[Native Firebase] Error verifying OTP:", error);
    return {
      success: false,
      message: error.message || "Invalid verification code"
    };
  }
};
