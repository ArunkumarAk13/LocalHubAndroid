import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { cn } from "@/lib/utils";

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  onChange?: (partialOtp: string) => void;
  isError?: boolean;
  className?: string;
  disabled?: boolean;
}

export function OTPInput({
  length = 6,
  onComplete,
  onChange,
  isError = false,
  className,
  disabled = false
}: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Focus on first input when component mounts
  useEffect(() => {
    if (inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only accept numbers
    if (!/^\d*$/.test(value)) return;
    
    // Take only the last character if multiple characters are pasted
    const digit = value.substring(value.length - 1);
    
    // Update OTP state
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    
    // Call onChange handler with partial OTP
    const otpValue = newOtp.join('');
    if (onChange) {
      onChange(otpValue);
    }
    
    // Check if OTP is complete
    if (newOtp.every(val => val !== '') && otpValue.length === length) {
      onComplete(otpValue);
    }
    
    // Move focus to next input if current input is filled
    if (digit && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to move to previous input
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    } 
    
    // Handle right arrow key
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
    
    // Handle left arrow key
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    const pastedData = e.clipboardData.getData('text/plain').trim();
    
    // Check if pasted data contains only digits
    if (!/^\d+$/.test(pastedData)) return;
    
    // Take only the first 'length' characters
    const digits = pastedData.substring(0, length).split('');
    
    // Fill OTP fields
    const newOtp = [...otp];
    digits.forEach((digit, idx) => {
      if (idx < length) {
        newOtp[idx] = digit;
      }
    });
    
    setOtp(newOtp);
    
    // Move focus to last filled input or the next empty one
    const lastFilledIndex = Math.min(digits.length, length) - 1;
    if (lastFilledIndex >= 0) {
      inputRefs.current[lastFilledIndex].focus();
      
      // Check if OTP is complete
      const otpValue = newOtp.join('');
      if (newOtp.every(val => val !== '') && otpValue.length === length) {
        onComplete(otpValue);
      }
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 w-full",
        className
      )}
    >
      {Array(length)
        .fill(0)
        .map((_, index) => (
          <input
            key={index}
            type="text"
            maxLength={1}
            ref={(el) => (inputRefs.current[index] = el as HTMLInputElement)}
            value={otp[index]}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            className={cn(
              "h-12 w-12 rounded-md border border-input bg-background text-xl text-center font-medium transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
              isError && "border-destructive focus:border-destructive focus:ring-destructive",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
            inputMode="numeric"
            aria-label={`OTP digit ${index + 1}`}
          />
        ))}
    </div>
  );
} 