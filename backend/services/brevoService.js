const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];

// Log Brevo configuration
console.log('Initializing Brevo service with configuration:', {
  hasApiKey: !!process.env.BREVO_API_KEY,
  senderEmail: process.env.BREVO_SENDER_EMAIL,
  senderName: process.env.BREVO_SENDER_NAME
});

if (!process.env.BREVO_API_KEY) {
  console.error('BREVO_API_KEY is not configured in environment variables');
}
if (!process.env.BREVO_SENDER_EMAIL) {
  console.error('BREVO_SENDER_EMAIL is not configured in environment variables');
}

apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const sendOTPEmail = async (email, otp) => {
  console.log('sendOTPEmail called with:', {
    email,
    otpLength: otp?.length
  });

  // Validate required environment variables
  if (!process.env.BREVO_API_KEY) {
    console.error('BREVO_API_KEY is missing');
    throw new Error('BREVO_API_KEY is not configured');
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    console.error('BREVO_SENDER_EMAIL is missing');
    throw new Error('BREVO_SENDER_EMAIL is not configured');
  }

  const sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME || 'LocalHub'
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
    console.log('Attempting to send email with data:', {
      to: email,
      from: sender.email,
      senderName: sender.name
    });

    const response = await apiInstance.sendTransacEmail(emailData);
    console.log('Email sent successfully:', {
      messageId: response.messageId,
      response: response
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', {
      message: error.message,
      response: error.response?.text,
      status: error.status,
      stack: error.stack,
      error: error
    });

    // Add more specific error information
    if (error.response?.text) {
      try {
        const errorDetails = JSON.parse(error.response.text);
        console.error('Brevo API error details:', errorDetails);
      } catch (e) {
        console.error('Could not parse error response:', error.response.text);
      }
    }

    throw error;
  }
};

module.exports = {
  sendOTPEmail
}; 