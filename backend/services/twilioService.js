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
            // Format phone number to E.164 format
            const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            
            // Send verification code
            const verification = await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verifications.create({ to: formattedNumber, channel: 'sms' });

            return {
                success: true,
                message: 'OTP sent successfully',
                status: verification.status
            };
        } catch (error) {
            console.error('Error sending OTP:', error);
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
            // Format phone number to E.164 format
            const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            
            // Verify the code
            const verificationCheck = await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verificationChecks.create({ to: formattedNumber, code: otpCode });

            if (verificationCheck.status === 'approved') {
                return {
                    success: true,
                    message: 'Phone number verified successfully'
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid verification code'
                };
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            return {
                success: false,
                message: 'Failed to verify OTP',
                error: error.message
            };
        }
    }
};

module.exports = twilioService; 