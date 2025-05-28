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
import { authAPI } from '../api';

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
  const { register } = useAuth();
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
    mode: "onChange",
  });

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
    const sanitizedValue = value.replace(/\D/g, '').slice(0, 10);
    onChange(sanitizedValue);
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
    setFormValues(values);
    setIsLoading(true);
    setOtpError(null);
    
    try {
      console.log('[Register] Starting OTP request process');
      console.log('[Register] Platform:', Capacitor.getPlatform());
      console.log('[Register] Is Android:', Capacitor.getPlatform() === 'android');
      console.log('[Register] Phone number:', values.phoneNumber);
      
      const response = await authAPI.requestOTP(
        values.phoneNumber,
        values.name,
        values.password,
        values.confirmPassword
      );
      
      if (response.success) {
        setRegistrationStep(RegistrationStep.OTP_VERIFICATION);
        startOtpCountdown();
        toast({
          title: "Success",
          description: "OTP sent successfully",
        });
      } else {
        setOtpError(response.message || "Failed to send OTP. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: response.message || "Failed to send OTP. Please try again.",
        });
      }
    } catch (error: any) {
      console.error('[Register] Error requesting OTP:', error);
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
      const response = await authAPI.requestOTP(formValues.phoneNumber);
      
      if (response.success) {
        startOtpCountdown();
        toast({
          title: "Success",
          description: "OTP resent successfully",
        });
      } else {
        setOtpError(response.message || "Failed to resend OTP. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: response.message || "Failed to resend OTP. Please try again.",
        });
      }
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      setOtpError(error.message || "Something went wrong. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend OTP. Please try again.",
      });
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
      console.log('[Register] Verifying OTP for phone:', formValues.phoneNumber);
      
      const verifyResponse = await authAPI.verifyOTP(formValues.phoneNumber, otp);
      
      if (verifyResponse.success) {
        console.log('[Register] OTP verified successfully, completing registration');
        
        // Complete registration
        const registerResponse = await authAPI.registerWithOTP(
          formValues.name,
          formValues.phoneNumber,
          formValues.password,
          otp
        );
        
        if (registerResponse.success) {
          toast({
            title: "Success",
            description: "Registration completed successfully",
          });
          // Navigate to login or home page
          window.location.href = '/login';
        } else {
          setOtpError(registerResponse.message || "Failed to complete registration. Please try again.");
          toast({
            variant: "destructive",
            title: "Error",
            description: registerResponse.message || "Failed to complete registration. Please try again.",
          });
        }
      } else {
        setOtpError(verifyResponse.message || "Invalid OTP. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: verifyResponse.message || "Invalid OTP. Please try again.",
        });
      }
    } catch (error: any) {
      console.error('[Register] Error verifying OTP:', error);
      setOtpError(error.message || "Something went wrong. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
      });
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
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                            <Input
                              {...field}
                              className="pl-10"
                              placeholder="Enter your name"
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
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                            <Input
                              {...field}
                              className="pl-10"
                              placeholder="Enter your phone number"
                              onChange={(e) => handlePhoneChange(e, field.onChange)}
                            />
                          </div>
                        </FormControl>
                        {phoneError && (
                          <p className="text-sm text-destructive">{phoneError}</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              className="pl-10 pr-10"
                              placeholder="Enter your password"
                              onFocus={() => setIsPasswordFocused(true)}
                              onBlur={() => setIsPasswordFocused(false)}
                              onChange={(e) => {
                                field.onChange(e);
                                checkPasswordRequirements(e.target.value);
                              }}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 transform -translate-y-1/2"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        {isPasswordFocused && (
                          <div className="mt-2 space-y-1 text-sm">
                            <p className={passwordRequirements.minLength ? "text-green-500" : "text-muted-foreground"}>
                              • At least 8 characters
                            </p>
                            <p className={passwordRequirements.hasUppercase ? "text-green-500" : "text-muted-foreground"}>
                              • One uppercase letter
                            </p>
                            <p className={passwordRequirements.hasNumber ? "text-green-500" : "text-muted-foreground"}>
                              • One number
                            </p>
                            <p className={passwordRequirements.hasSymbol ? "text-green-500" : "text-muted-foreground"}>
                              • One special character
                            </p>
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
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              className="pl-10 pr-10"
                              placeholder="Confirm your password"
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 transform -translate-y-1/2"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
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
                  
                  <div className="flex gap-4">
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