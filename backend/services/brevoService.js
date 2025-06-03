const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];

// Log Brevo configuration
console.log('Brevo Configuration:');
console.log('API Key exists:', !!process.env.BREVO_API_KEY);
console.log('Sender Email:', process.env.BREVO_SENDER_EMAIL);
console.log('Sender Name:', process.env.BREVO_SENDER_NAME);

apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const sendOTPEmail = async (email, otp) => {
  // Validate required environment variables
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured');
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error('BREVO_SENDER_EMAIL is not configured');
  }

  const sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME || 'Your App Name'
  };

  const receivers = [{
    email: email
  }];

  const emailData = {
    sender,
    to: receivers,
    subject: 'Email Verification Code',
    htmlContent: `
      <html>
        <body>
          <h1>Email Verification</h1>
          <p>Your verification code is: <strong>${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </body>
      </html>
    `
  };

  try {
    console.log('Attempting to send email to:', email);
    console.log('Email data:', JSON.stringify(emailData, null, 2));
    
    const response = await apiInstance.sendTransacEmail(emailData);
    console.log('Email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending email:', {
      message: error.message,
      response: error.response?.text,
      status: error.status,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = {
  sendOTPEmail
}; 