import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  PhoneAuthProvider,
  signOut
} from "firebase/auth";

// Add at the top of firebase.ts
declare global {
  interface Window {
    recaptchaVerifier?: any;
    confirmationResult?: any;
  }
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlLdat_gElrBmyzeI9Tsc3F2-KhjexP4c",
  authDomain: "localhub-2cb36.firebaseapp.com",
  projectId: "localhub-2cb36",
  storageBucket: "localhub-2cb36.firebasestorage.app",
  messagingSenderId: "51298973177",
  appId: "1:51298973177:web:0dbf9b4c1773ac78927928",
  measurementId: "G-KSH1BK9WY0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Return current auth instance
export const getFirebaseAuth = () => auth;

// Send OTP to phone number
export const sendOTP = async (phoneNumber: string) => {
  try {
    // Make sure to format the phone number with country code
    const formattedPhoneNumber = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+91${phoneNumber}`; // Assuming India, change as needed

    // Create invisible reCAPTCHA
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
    }

    // Request OTP
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      formattedPhoneNumber,
      window.recaptchaVerifier
    );
    
    // Store confirmation result for later verification
    window.confirmationResult = confirmationResult;
    
    return { success: true };
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return { 
      success: false, 
      message: error.message || "Failed to send verification code" 
    };
  }
};

// Verify OTP
export const verifyOTP = async (otp: string) => {
  try {
    if (!window.confirmationResult) {
      throw new Error("No verification code was sent");
    }
    
    // Confirm the verification code
    const result = await window.confirmationResult.confirm(otp);
    
    return { 
      success: true, 
      user: result.user 
    };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return { 
      success: false, 
      message: error.message || "Invalid verification code" 
    };
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error signing out:", error);
    return { 
      success: false, 
      message: error.message || "Failed to sign out" 
    };
  }
};
