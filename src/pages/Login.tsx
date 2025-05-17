import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Phone, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define the form schema
const formSchema = z.object({
  phoneNumber: z.string().min(10, { message: "Please enter a valid phone number" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const Login = () => {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
      password: "",
    },
  });

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoginError(null); // Clear previous errors
    try {
      const result = await login(values.phoneNumber, values.password);
      if (!result) {
        setLoginError("Phone number or password is incorrect");
        // Keep the form's error state
        form.setError("phoneNumber", { type: "manual" });
        form.setError("password", { type: "manual" });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError("Phone number or password is incorrect");
      form.setError("phoneNumber", { type: "manual" });
      form.setError("password", { type: "manual" });
    }
  };

  // Prevent form from submitting normally
  const handleSubmit = (e: React.FormEvent) => {
    if (loginError) {
      e.preventDefault();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/20 px-4 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to access your account</p>
        </div>
        
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            {loginError && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={(e) => {
                e.preventDefault(); // Always prevent default form submission
                form.handleSubmit(onSubmit)(e);
              }} className="space-y-6">
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
                            placeholder="Enter your phone number" 
                            className={`pl-10 h-12 text-base ${loginError ? "border-destructive focus-visible:ring-destructive" : ""}`} 
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
                            className={`pl-10 h-12 text-base ${loginError ? "border-destructive focus-visible:ring-destructive" : ""}`} 
                            {...field} 
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90"
                >
                  Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-6">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="font-medium text-primary hover:text-primary/90 transition-colors">
                Create Account
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
