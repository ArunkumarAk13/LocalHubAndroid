import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Phone } from "lucide-react";

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

const Register = () => {
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
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
      password: "",
      confirmPassword: "",
      phoneNumber: "",
    },
    mode: "onChange", // Enable validation on change
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

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await register(values.name, values.phoneNumber, values.password);
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
                  disabled={!!phoneError && form.formState.isSubmitting}
                >
                  Create Account <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
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
