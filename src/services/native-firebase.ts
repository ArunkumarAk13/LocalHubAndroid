import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase app only if it hasn't been initialized
let app;
let auth;
let currentVerificationId: string | null = null;

// Event handling
let phoneCodeSentResolver: ((verificationId: string) => void) | null = null;
let phoneCodeSentRejecter: ((error: any) => void) | null = null;

let isInitialized = false;
let isAuthInitialized = false;

// Initialize Firebase immediately
try {
  if (getApps().length === 0) {
    console.log('[Native Firebase] Initializing Firebase app...');
    console.log('[Native Firebase] Using google-services.json for Android configuration');
    console.log('[Native Firebase] Project ID:', firebaseConfig.projectId);
    console.log('[Native Firebase] App ID:', firebaseConfig.appId);
    console.log('[Native Firebase] API Key:', firebaseConfig.apiKey);
    console.log('[Native Firebase] Auth Domain:', firebaseConfig.authDomain);
    console.log('[Native Firebase] Storage Bucket:', firebaseConfig.storageBucket);
    console.log('[Native Firebase] Messaging Sender ID:', firebaseConfig.messagingSenderId);
    
    app = initializeApp(firebaseConfig);
    console.log('[Native Firebase] Firebase app initialized successfully');
  } else {
    console.log('[Native Firebase] Using existing Firebase app');
    app = getApp();
  }
  
  auth = getAuth(app);
  console.log('[Native Firebase] Firebase auth initialized successfully');
  
  // Set up auth state listener
  onAuthStateChanged(auth, (user) => {
    console.log('[Native Firebase] Auth state changed:', user ? 'User signed in' : 'No user');
  });
  
  // Check if we're in debug or release mode
  if (Capacitor.getPlatform() === 'android') {
    console.log('[Native Firebase] Running on Android platform');
    console.log('[Native Firebase] App package name:', Capacitor.getPlatform() === 'android' ? 'com.localhub.app' : 'unknown');
  }
} catch (error) {
  console.error('[Native Firebase] Error initializing Firebase:', error);
  console.error('[Native Firebase] Error details:', {
    message: error.message,
    code: error.code,
    stack: error.stack,
    name: error.name
  });
}

/**
 * Check if we should use native authentication
 * Only use native on Android with the plugin installed
 */
export const shouldUseNativeAuth = () => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Configure Firebase Authentication before using it
 */
export async function initializeFirebase() {
  try {
    console.log('[Native Firebase] Starting Firebase initialization...');
    const platform = Capacitor.getPlatform();
    console.log('[Native Firebase] Platform:', platform);

    if (platform === 'android') {
      // Initialize Firebase Auth
      console.log('[Native Firebase] Initializing Firebase Auth...');
      isAuthInitialized = true;
      console.log('[Native Firebase] Firebase Auth initialized successfully');
    }

    isInitialized = true;
    console.log('[Native Firebase] Firebase initialization completed successfully');
    return true;
  } catch (error) {
    console.error('[Native Firebase] Error initializing Firebase:', error);
    return false;
  }
}

/**
 * Send OTP via native Firebase SDK
 */
export async function sendNativeOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Native Firebase] Starting OTP flow for:', phoneNumber);
    const platform = Capacitor.getPlatform();
    console.log('[Native Firebase] Platform:', platform);

    if (!isInitialized) {
      const initialized = await initializeFirebase();
      if (!initialized) {
        throw new Error('Failed to initialize Firebase');
      }
    }

    console.log('[Native Firebase] Firebase app initialized:', isInitialized);
    console.log('[Native Firebase] Firebase auth initialized:', isAuthInitialized);

    // Format phone number
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    console.log('[Native Firebase] Formatted phone number:', formattedPhone);

    if (platform === 'android') {
      console.log('[Native Firebase] Initializing Firebase Auth...');
      console.log('[Native Firebase] Starting Firebase Auth initialization...');

      // Set language code
      await FirebaseAuthentication.setLanguageCode({ languageCode: 'en' });
      console.log('[Native Firebase] Language code set successfully');

      // Use app language
      await FirebaseAuthentication.useAppLanguage();
      console.log('[Native Firebase] App language configured successfully');

      console.log('[Native Firebase] Firebase Auth initialization completed successfully');
      console.log('[Native Firebase] Firebase Auth initialized successfully');

      // Send verification code
      console.log('[Native Firebase] Attempting to send verification code to:', formattedPhone);
      console.log('[Native Firebase] Setting up phone code sent listener');

      // Add listener for phone code sent
      await FirebaseAuthentication.addListener('phoneCodeSent', () => {
        console.log('[Native Firebase] Phone code sent successfully');
      });

      console.log('[Native Firebase] Calling signInWithPhoneNumber');
      await FirebaseAuthentication.signInWithPhoneNumber({
        phoneNumber: formattedPhone,
        timeout: 60000
      });
      console.log('[Native Firebase] signInWithPhoneNumber completed');

      return { success: true };
    } else {
      throw new Error('Phone authentication is only supported on Android');
    }
  } catch (error: any) {
    console.error('[Native Firebase] Error sending OTP:', error);
    let errorMessage = 'Failed to send verification code';
    
    if (error.message?.includes('Invalid PlayIntegrity token')) {
      errorMessage = 'Device verification failed. Please try again or contact support.';
    } else if (error.message?.includes('not authorized')) {
      errorMessage = 'App verification failed. Please try again or contact support.';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.message?.includes('quota exceeded')) {
      errorMessage = 'Too many attempts. Please try again later.';
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Verify OTP via native Firebase SDK
 */
export async function verifyOTP(verificationId: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Native Firebase] Verifying OTP...');
    const platform = Capacitor.getPlatform();

    if (platform === 'android') {
      await FirebaseAuthentication.confirmVerificationCode({
        verificationId,
        verificationCode: otp
      });
      console.log('[Native Firebase] OTP verified successfully');
      return { success: true };
    } else {
      throw new Error('Phone authentication is only supported on Android');
    }
  } catch (error: any) {
    console.error('[Native Firebase] Error verifying OTP:', error);
    let errorMessage = 'Failed to verify code';
    
    if (error.message?.includes('invalid')) {
      errorMessage = 'Invalid verification code';
    } else if (error.message?.includes('expired')) {
      errorMessage = 'Verification code has expired';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection.';
    }
    
    return { success: false, error: errorMessage };
  }
}
