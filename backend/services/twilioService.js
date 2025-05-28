const twilio = require('twilio');

// Initialize Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const twilioService = {
    // Send OTP
    async sendOTP(phoneNumber) {
        try {
            console.log('[TwilioService] Sending OTP to:', phoneNumber);
            
            // Format phone number to E.164 format
            const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            console.log('[TwilioService] Formatted phone number:', formattedNumber);
            
            // Send verification code
            console.log('[TwilioService] Using service SID:', process.env.TWILIO_VERIFY_SERVICE_SID);
            const verification = await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verifications.create({ to: formattedNumber, channel: 'sms' });

            console.log('[TwilioService] Verification response:', JSON.stringify(verification, null, 2));

            return {
                success: true,
                message: 'OTP sent successfully',
                status: verification.status
            };
        } catch (error) {
            console.error('[TwilioService] Error sending OTP:', error);
            return {
                success: false,
                message: 'Failed to send OTP',
                error: error.message
            };
        }
    },

    // Verify OTP
    async verifyOTP(phoneNumber, otpCode) {
        try {
            console.log('[TwilioService] Verifying OTP for:', phoneNumber);
            console.log('[TwilioService] OTP code:', otpCode);
            
            // Format phone number to E.164 format
            const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            console.log('[TwilioService] Formatted phone number:', formattedNumber);
            
            console.log('[TwilioService] Using service SID:', process.env.TWILIO_VERIFY_SERVICE_SID);
            
            // Verify the code
            const verificationCheck = await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verificationChecks.create({ 
                    to: formattedNumber, 
                    code: otpCode 
                });

            console.log('[TwilioService] Verification check response:', JSON.stringify(verificationCheck, null, 2));

            if (verificationCheck.status === 'approved') {
                return {
                    success: true,
                    message: 'Phone number verified successfully'
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid verification code',
                    status: verificationCheck.status
                };
            }
        } catch (error) {
            console.error('[TwilioService] Error verifying OTP:', error);
            return {
                success: false,
                message: 'Failed to verify OTP',
                error: error.message
            };
        }
    }
};

module.exports = twilioService; 