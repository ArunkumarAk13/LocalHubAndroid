import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Lock, User, ArrowRight, Eye, EyeOff, Phone, Loader2, ArrowLeft } from "lucide-react";
import { Capacitor } from '@capacitor/core';
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OTPInput } from "@/components/ui/otp-input";
import { sendOTP, verifyOTP } from '../services/firebase'; // web version
import { sendNativeOTP, verifyNativeOTP, setOtpSentCallback } from '../services/native-firebase';

// Define the form schema with validation
const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" })
    .refine(
      (password) => /[A-Z]/.test(password),
      { message: "Password must contain at least one uppercase letter" }
    )
    .refine(
      (password) => /[0-9]/.test(password),
      { message: "Password must contain at least one number" }
    )
    .refine(
      (password) => /[^A-Za-z0-9]/.test(password),
      { message: "Password must contain at least one special character" }
    ),
  confirmPassword: z.string().min(8, { message: "Confirm password is required" }),
  phoneNumber: z.string().length(10, { message: "Phone number must be exactly 10 digits" })
    .refine((val) => /^\d+$/.test(val), { message: "Phone number must contain only digits" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Registration step states
enum RegistrationStep {
  FORM = 'form',
  OTP_VERIFICATION = 'otp_verification'
}

const Register = () => {
  const { toast } = useToast();
  const { register, requestOTP, verifyOTP, registerWithOTP } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>(RegistrationStep.FORM);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formValues, setFormValues] = useState<z.infer<typeof formSchema> | null>(null);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [otpValue, setOtpValue] = useState<string>('');
  
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUppercase: false,
    hasNumber: false,
    hasSymbol: false
  });
  
  const isAndroid = Capacitor.getPlatform() === 'android';
  
  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      password: "",
      confirmPassword: "",
      phoneNumber: "",
    },
    mode: "onChange", // Enable validation on change
  });

  // Add the recaptcha container to the DOM
  useEffect(() => {
    // Create invisible recaptcha container if needed
    if (!document.getElementById('recaptcha-container')) {
      const recaptchaContainer = document.createElement('div');
      recaptchaContainer.id = 'recaptcha-container';
      recaptchaContainer.style.display = 'none';
      document.body.appendChild(recaptchaContainer);
    }
    
    return () => {
      // Clean up on unmount if needed
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.remove();
      }
    };
  }, []);

  // Set up OTP sent callback
  useEffect(() => {
    if (isAndroid) {
      const handleOtpSent = (verificationId: string) => {
        console.log('[Register] OTP sent callback received:', verificationId);
        try {
          // Use functional updates to ensure we have the latest state
          setRegistrationStep(() => RegistrationStep.OTP_VERIFICATION);
          startOtpCountdown();
          setIsLoading(() => false);
          toast({
            title: "Success",
            description: "OTP sent successfully",
          });
        } catch (error) {
          console.error('[Register] Error handling OTP sent callback:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to process OTP. Please try again.",
          });
          setIsLoading(false);
        }
      };

      console.log('[Register] Setting up OTP sent callback');
      const cleanup = setOtpSentCallback(handleOtpSent);

      // Cleanup callback on unmount
      return () => {
        console.log('[Register] Cleaning up OTP sent callback');
        cleanup();
      };
    }
  }, [isAndroid, toast]); // Add toast to dependencies

  // Function to validate phone number in real time
  const validatePhoneNumber = (value: string) => {
    if (value.length > 10) {
      return "Phone number cannot be more than 10 digits";
    }
    if (value.length < 10 && value.length > 0) {
      return "Phone number must be 10 digits";
    }
    if (!/^\d*$/.test(value)) {
      return "Phone number must contain only digits";
    }
    return null;
  };

  // Handle phone number changes
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const value = e.target.value;
    
    // Allow only digits and limit to 10 characters
    const sanitizedValue = value.replace(/\D/g, '').slice(0, 10);
    
    // Update form value
    onChange(sanitizedValue);
    
    // Set error state for immediate feedback
    setPhoneError(validatePhoneNumber(sanitizedValue));
  };

  // Check password requirements in real time
  const checkPasswordRequirements = (password: string) => {
    setPasswordRequirements({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSymbol: /[^A-Za-z0-9]/.test(password)
    });
  };
  
  // Start OTP countdown timer
  const startOtpCountdown = () => {
    setOtpResendCountdown(60);
    const timer = setInterval(() => {
      setOtpResendCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    console.log('[Register] Starting OTP request process');
    console.log('[Register] Platform:', Capacitor.getPlatform());
    console.log('[Register] Is Android:', isAndroid);
    
    setFormValues(values);
    setIsLoading(true);
    setOtpError(null);
    
    try {
      // For Android, try direct Firebase API first
      if (isAndroid) {
        try {
          console.log('[Register] Attempting to send native OTP');
          console.log('[Register] Phone number:', values.phoneNumber);
          const result = await sendNativeOTP(values.phoneNumber);
          console.log('[Register] Native OTP send result:', result);
          // The callback will handle the navigation and toast
          return;
        } catch (nativeError: any) {
          console.error("[Register] Native auth failed:", {
            error: nativeError,
            message: nativeError.message,
            code: nativeError.code,
            stack: nativeError.stack
          });
          setPhoneError(nativeError.message || "Failed to send verification code. Try again later.");
          setIsLoading(false);
          toast({
            variant: "destructive",
            title: "Error",
            description: nativeError.message || "Failed to send OTP. Please try again.",
          });
          return;
        }
      }
      
      // Fallback to web version if native fails
      console.log('[Register] Falling back to web OTP');
      const otpResponse = await requestOTP(values.phoneNumber);
      
      if (otpResponse.success) {
        setRegistrationStep(RegistrationStep.OTP_VERIFICATION);
        startOtpCountdown();
        toast({
          title: "Success",
          description: "OTP sent successfully",
        });
      } else {
        setOtpError(otpResponse.message || "Failed to send OTP. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: otpResponse.message || "Failed to send OTP. Please try again.",
        });
      }
    } catch (error: any) {
      console.error('[Register] Error requesting OTP:', {
        error,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      setOtpError(error.message || "Something went wrong. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send OTP. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle OTP resend
  const handleResendOTP = async () => {
    if (otpResendCountdown > 0 || !formValues) return;
    
    setIsLoading(true);
    setOtpError(null);
    
    try {
      const otpResponse = await requestOTP(formValues.phoneNumber);
      
      if (otpResponse.success) {
        startOtpCountdown();
      } else {
        setOtpError(otpResponse.message || "Failed to resend OTP. Please try again.");
      }
    } catch (error) {
      console.error('Error resending OTP:', error);
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle OTP verification and complete registration
  const handleVerifyOTP = async (otp: string) => {
    if (!formValues) return;
    
    setIsLoading(true);
    setOtpError(null);
    
    try {
      console.log("Verifying OTP:", otp);
      let verifyResponse;
      
      if (isAndroid) {
        // Use native verification for Android
        console.log("Using native verification method");
        verifyResponse = await verifyNativeOTP(otp);
        console.log("Native verify response:", verifyResponse);
      } else {
        // Use web verification
        console.log("Using web verification method");
        verifyResponse = await verifyOTP(formValues.phoneNumber, otp);
      }
      
      if (verifyResponse.success) {
        console.log("OTP verification successful, completing registration");
        // Complete registration with verified OTP
        const registerResponse = await registerWithOTP(
          formValues.name,
          formValues.phoneNumber,
          formValues.password,
          otp,
          verifyResponse.user?.uid || `temp-${Date.now()}` // Fallback for development mode
        );
        
        if (!registerResponse) {
          setOtpError("Failed to complete registration. Please try again.");
        }
      } else {
        // Show the error message from the verification response
        console.error("OTP verification failed:", verifyResponse.message);
        setOtpError(verifyResponse.message || "Invalid OTP. Please try again.");
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setOtpError(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Go back to form step
  const handleBackToForm = () => {
    setRegistrationStep(RegistrationStep.FORM);
    setOtpError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/20 px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">Create Account</h1>
          <p className="text-muted-foreground">
            {registrationStep === RegistrationStep.FORM 
              ? 'Join our community today' 
              : 'Verify your phone number'}
          </p>
        </div>
        
        {/* Hidden recaptcha container for Firebase */}
        <div id="recaptcha-container" className="hidden"></div>
        
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            {/* Registration Form */}
            {registrationStep === RegistrationStep.FORM && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Full Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                              <User size={18} />
                            </div>
                            <Input 
                              placeholder="John Doe" 
                              className="pl-10 h-12 text-base" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Phone Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                              <Phone size={18} />
                            </div>
                            <Input 
                              placeholder="Enter 10 digit number" 
                              className={`pl-10 h-12 text-base ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                              value={field.value}
                              onChange={(e) => handlePhoneChange(e, field.onChange)}
                              maxLength={10}
                              inputMode="numeric"
                            />
                          </div>
                        </FormControl>
                        {phoneError && <p className="text-sm font-medium text-destructive mt-1">{phoneError}</p>}
                        <div className="hidden">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                              <Lock size={18} />
                            </div>
                            <Input 
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••" 
                              className="pl-10 h-12 text-base" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                checkPasswordRequirements(e.target.value);
                              }}
                              onFocus={() => setIsPasswordFocused(true)}
                              onBlur={(e) => {
                                // Only hide requirements if field is empty
                                if (!e.target.value) {
                                  setIsPasswordFocused(false);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              className="absolute top-1/2 -translate-y-1/2 right-0 px-3 text-muted-foreground bg-transparent hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </Button>
                          </div>
                        </FormControl>
                        {isPasswordFocused && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="flex items-center text-xs">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${passwordRequirements.minLength ? 'bg-green-500' : 'bg-red-500'}`}>
                                {passwordRequirements.minLength ? (
                                  <span className="text-white text-[10px]">✓</span>
                                ) : (
                                  <span className="text-white text-[10px]">✕</span>
                                )}
                              </div>
                              <span className={passwordRequirements.minLength ? 'text-green-700' : 'text-red-700'}>
                                Minimum 8 characters
                              </span>
                            </div>
                            <div className="flex items-center text-xs">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${passwordRequirements.hasUppercase ? 'bg-green-500' : 'bg-red-500'}`}>
                                {passwordRequirements.hasUppercase ? (
                                  <span className="text-white text-[10px]">✓</span>
                                ) : (
                                  <span className="text-white text-[10px]">✕</span>
                                )}
                              </div>
                              <span className={passwordRequirements.hasUppercase ? 'text-green-700' : 'text-red-700'}>
                                One uppercase letter
                              </span>
                            </div>
                            <div className="flex items-center text-xs">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${passwordRequirements.hasNumber ? 'bg-green-500' : 'bg-red-500'}`}>
                                {passwordRequirements.hasNumber ? (
                                  <span className="text-white text-[10px]">✓</span>
                                ) : (
                                  <span className="text-white text-[10px]">✕</span>
                                )}
                              </div>
                              <span className={passwordRequirements.hasNumber ? 'text-green-700' : 'text-red-700'}>
                                One number
                              </span>
                            </div>
                            <div className="flex items-center text-xs">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${passwordRequirements.hasSymbol ? 'bg-green-500' : 'bg-red-500'}`}>
                                {passwordRequirements.hasSymbol ? (
                                  <span className="text-white text-[10px]">✓</span>
                                ) : (
                                  <span className="text-white text-[10px]">✕</span>
                                )}
                              </div>
                              <span className={passwordRequirements.hasSymbol ? 'text-green-700' : 'text-red-700'}>
                                One symbol
                              </span>
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                              <Lock size={18} />
                            </div>
                            <Input 
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="••••••••" 
                              className="pl-10 h-12 text-base" 
                              {...field} 
                            />
                            <Button
                              type="button"
                              className="absolute top-1/2 -translate-y-1/2 right-0 px-3 text-muted-foreground bg-transparent hover:bg-transparent"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90"
                    disabled={(!!phoneError || isLoading) && form.formState.isSubmitting}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}
            
            {/* OTP Verification */}
            {registrationStep === RegistrationStep.OTP_VERIFICATION && formValues && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold mb-2">Verify Your Phone Number</h2>
                  <p className="text-muted-foreground text-sm">
                    We've sent a 6-digit code to {formValues.phoneNumber}
                  </p>
                </div>
                
                {otpError && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{otpError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4">
                  <Label className="text-base" htmlFor="otp">Enter verification code</Label>
                  <OTPInput 
                    length={6} 
                    onComplete={(code) => {
                      setOtpValue(code);
                    }}
                    onChange={(code) => {
                      setOtpValue(code);
                    }}
                    isError={!!otpError}
                    disabled={isLoading}
                  />
                  
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={handleResendOTP}
                      disabled={otpResendCountdown > 0 || isLoading}
                      className="text-sm"
                    >
                      {otpResendCountdown > 0 
                        ? `Resend code in ${otpResendCountdown}s` 
                        : 'Resend verification code'}
                    </Button>
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleBackToForm}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => handleVerifyOTP(otpValue)}
                      disabled={isLoading || otpValue.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Complete Registration
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-6">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:text-primary/90 transition-colors">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Register;