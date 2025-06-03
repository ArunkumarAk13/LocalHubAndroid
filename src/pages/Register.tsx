import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Lock, User, ArrowRight, Eye, EyeOff, Phone, Mail } from "lucide-react";
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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { authAPI } from "@/api";
import { Capacitor } from '@capacitor/core';

// Define the form schema with validation
const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phoneNumber: z.string().length(10, { message: "Phone number must be exactly 10 digits" })
    .refine((val) => /^\d+$/.test(val), { message: "Phone number must contain only digits" }),
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
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const Register = () => {
  const { toast } = useToast();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [otp, setOTP] = useState("");
  const [registrationData, setRegistrationData] = useState<any>(null);
  
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUppercase: false,
    hasNumber: false,
    hasSymbol: false
  });
  
  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
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

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    
    try {
      const response = await authAPI.sendEmailOTP(
        values.email,
        values.name,
        values.phoneNumber,
        values.password
      );
      
      if (response.success) {
        setRegistrationData(values);
        setShowOTPInput(true);
        toast({
          title: "Success",
          description: "Verification code sent to your email",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: response.message || "Failed to send verification code",
        });
      }
    } catch (error: any) {
      console.error('[Register] Error during registration:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Registration failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async () => {
    if (!registrationData || !otp) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter the verification code",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.verifyEmailOTP(registrationData.email, otp);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Registration completed successfully",
        });
        
        // Add a small delay before navigation on mobile
        if (Capacitor.isNativePlatform()) {
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 1000);
        } else {
          navigate('/login', { replace: true });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: response.message || "Verification failed",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Verification failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/20 px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">Create Account</h1>
          <p className="text-muted-foreground">Join our community today</p>
        </div>
        
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            {!showOTPInput ? (
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
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                            <Input
                              {...field}
                              className="pl-10"
                              placeholder="Enter your email"
                              type="email"
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
                              maxLength={10}
                              inputMode="numeric"
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
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>Sending Verification Code...</>
                    ) : (
                      <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-6">
                <FormItem>
                  <FormLabel>Verification Code</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Enter verification code"
                        value={otp}
                        onChange={(e) => setOTP(e.target.value)}
                        className="pl-3"
                        maxLength={6}
                      />
                    </div>
                  </FormControl>
                  <p className="text-sm text-muted-foreground mt-2">
                    Please enter the verification code sent to your email
                  </p>
                </FormItem>

                <Button 
                  onClick={handleVerifyOTP}
                  className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90"
                  disabled={isLoading || !otp}
                >
                  {isLoading ? (
                    <>Verifying...</>
                  ) : (
                    <>Verify and Complete Registration <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>

                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowOTPInput(false);
                    setOTP("");
                    setRegistrationData(null);
                  }}
                >
                  Back to Registration
                </Button>
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