const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];

// Log Brevo configuration (safely)
const brevoConfig = {
  hasApiKey: !!process.env.BREVO_API_KEY,
  apiKeyLength: process.env.BREVO_API_KEY?.length,
  apiKeyPrefix: process.env.BREVO_API_KEY?.substring(0, 4),
  senderEmail: process.env.BREVO_SENDER_EMAIL,
  senderName: process.env.BREVO_SENDER_NAME || 'LocalHub'
};

console.log('Initializing Brevo service with configuration:', brevoConfig);

// Validate configuration
const configErrors = [];
if (!process.env.BREVO_API_KEY) {
  const error = 'BREVO_API_KEY is not configured in environment variables';
  console.error(error);
  configErrors.push(error);
} else if (!process.env.BREVO_API_KEY.startsWith('xkeysib-')) {
  const error = 'BREVO_API_KEY appears to be invalid (should start with xkeysib-)';
  console.error(error);
  configErrors.push(error);
}

if (!process.env.BREVO_SENDER_EMAIL) {
  const error = 'BREVO_SENDER_EMAIL is not configured in environment variables';
  console.error(error);
  configErrors.push(error);
} else if (!process.env.BREVO_SENDER_EMAIL.includes('@')) {
  const error = 'BREVO_SENDER_EMAIL appears to be invalid (should be a valid email address)';
  console.error(error);
  configErrors.push(error);
}

if (configErrors.length > 0) {
  console.error('Brevo service initialization failed:', configErrors);
}

// Set the API key
apiKey.apiKey = process.env.BREVO_API_KEY;

// Create API instance with validation
let apiInstance;
try {
  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  console.log('Successfully created Brevo API instance');
} catch (error) {
  console.error('Failed to create Brevo API instance:', error);
}

const sendOTPEmail = async (email, otp) => {
  console.log('sendOTPEmail called with:', {
    email,
    otpLength: otp?.length,
    config: {
      ...brevoConfig,
      apiInstance: !!apiInstance
    }
  });

  // Enhanced validation
  if (!process.env.BREVO_API_KEY) {
    const error = new Error('BREVO_API_KEY is not configured');
    error.code = 'MISSING_API_KEY';
    console.error('Missing API key:', error);
    throw error;
  }
  
  if (!process.env.BREVO_API_KEY.startsWith('xkeysib-')) {
    const error = new Error('Invalid Brevo API key format');
    error.code = 'INVALID_API_KEY_FORMAT';
    console.error('Invalid API key format:', error);
    throw error;
  }

  if (!process.env.BREVO_SENDER_EMAIL) {
    const error = new Error('BREVO_SENDER_EMAIL is not configured');
    error.code = 'MISSING_SENDER_EMAIL';
    console.error('Missing sender email:', error);
    throw error;
  }

  if (!apiInstance) {
    const error = new Error('Brevo API instance not initialized');
    error.code = 'API_INIT_ERROR';
    console.error('API initialization error:', error);
    throw error;
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
      senderName: sender.name,
      apiKeyValid: process.env.BREVO_API_KEY?.startsWith('xkeysib-')
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
      code: error.code,
      name: error.name,
      apiKeyPrefix: process.env.BREVO_API_KEY?.substring(0, 8)
    });

    // Add more specific error information
    if (error.response?.text) {
      try {
        const errorDetails = JSON.parse(error.response.text);
        console.error('Brevo API error details:', errorDetails);
        
        // Check for specific Brevo API errors
        if (errorDetails.code === 'unauthorized') {
          error.code = 'INVALID_API_KEY';
          error.message = 'Invalid Brevo API key';
        }
      } catch (e) {
        console.error('Could not parse error response:', error.response.text);
      }
    }

    // Enhance error with specific code if not set
    if (!error.code) {
      if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
        error.code = 'INVALID_API_KEY';
      } else if (error.message.includes('network')) {
        error.code = 'NETWORK_ERROR';
      } else {
        error.code = 'UNKNOWN_ERROR';
      }
    }

    throw error;
  }
};

module.exports = {
  sendOTPEmail
}; 