import express, { Request, Response } from 'express';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { config } from './config';

// Initialize Express application
const app = express();
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Define types for request bodies
interface SendOtpRequest {
  id_number: string;
}

interface ValidateOtpRequest {
  id_number: string;
  otp: string;
}

// Helper function to generate JWT token
const generateToken = (): string => {
  const timestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds
  const reqid = uuidv4(); // Unique request ID
  const payload = {
    timestamp,
    reqid,
    partnerId: config.PARTNER_ID,
  };
  
  try {
    // Using HS256 as the algorithm (adjust if different algorithm is required)
    return jwt.sign(payload, config.JWT_KEY, { algorithm: 'HS256' });
  } catch (error: any) {
    console.error("Error generating JWT token:", error.message);
    throw new Error("Failed to generate authentication token");
  }
};

// Helper function to make API requests with retries and logging
async function makeApiRequest(endpoint: string, data: any, retries = config.MAX_RETRIES) {
  const token = generateToken();
  const url = `${config.API_URL}${endpoint}`;
  
  const requestConfig: AxiosRequestConfig = {
    headers: {
      Token: token,
      Authorisedkey: config.AUTHORISED_KEY,
      'Content-Type': 'application/json',
      'User-Agent': config.PARTNER_ID,
    }
  };
  
  // Log the request details if debug mode is enabled
  if (config.DEBUG) {
    console.log('\n=== API Request ===');
    console.log('URL:', url);
    console.log('Headers:', JSON.stringify(requestConfig.headers, null, 2));
    console.log('Payload:', JSON.stringify(data, null, 2));
    console.log('===================\n');
  }
  
  try {
    const response = await axios.post(url, data, requestConfig);
    
    // Log the response if debug mode is enabled
    if (config.DEBUG) {
      console.log('\n=== API Response ===');
      console.log('Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      console.log('====================\n');
    }
    
    return response;
  } catch (error: any) {
    const axiosError = error as AxiosError;
    
    if (config.DEBUG) {
      console.error('\n=== API Error ===');
      console.error('Status:', axiosError.response?.status);
      console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
      console.error('================\n');
    }
    
    // Retry logic for specific errors
    if (retries > 0 && (
      !axiosError.response || 
      axiosError.response.status >= 500 || 
      axiosError.response.status === 429
    )) {
      console.log(`Retrying request... (${config.MAX_RETRIES - retries + 1}/${config.MAX_RETRIES})`);
      return makeApiRequest(endpoint, data, retries - 1);
    }
    
    throw error;
  }
}

// Route to send OTP
// @ts-ignore
app.post('/send-otp', async (req: Request<{}, {}, SendOtpRequest>, res: Response) => {
  const { id_number } = req.body;

  // Validate input
  if (!id_number) {
    return res.status(400).json({ error: 'Aadhar number is required' });
  }

  console.log(`Sending OTP request for Aadhar: ${id_number}`);
  
  try {
    const response = await makeApiRequest('verification/aadhaar_sendotp', { id_number });
    
    // Check for API-specific error responses (when status code is 200 but operation failed)
    if (response.data.status === false) {
      console.log('API returned error:', response.data.message);
      
      // Handle specific error messages
      if (response.data.message.includes('Invalid user')) {
        return res.status(401).json({ 
          error: 'Authentication failed', 
          details: 'The API rejected the credentials. Please check your Partner ID, JWT Key, and Authorised Key.',
          message: response.data.message,
          possibleSolutions: [
            'Verify all credentials in the config.ts file',
            'Ensure your IP address is whitelisted with the API provider',
            'Check if your account is active and has the necessary permissions'
          ]
        });
      }
      
      return res.status(400).json({ 
        error: 'API Error', 
        details: response.data.message 
      });
    }
    
    return res.json({ message: 'OTP sent successfully', data: response.data });
  } catch (error: any) {
    console.error('OTP API error:', error.message);
    
    // Handle different types of errors
    if (error.response) {
      // The request was made and the server responded with a non-2xx status code
      return res.status(error.response.status).json({ 
        error: 'API Error', 
        details: error.response.data 
      });
    } else if (error.request) {
      // The request was made but no response was received
      return res.status(503).json({ 
        error: 'Service Unavailable',
        details: 'No response received from the API server. Please try again later.'
      });
    } else {
      // Something happened in setting up the request
      return res.status(500).json({ 
        error: 'Request Setup Error',
        details: error.message
      });
    }
  }
});

// Route to validate OTP
// @ts-ignore
app.post('/validate-otp', async (req: Request<{}, {}, ValidateOtpRequest>, res: Response) => {
  const { id_number, otp } = req.body;

  // Validate input
  if (!id_number || !otp) {
    return res.status(400).json({ error: 'Aadhar number and OTP are required' });
  }

  console.log(`Validating OTP for Aadhar: ${id_number}`);
  
  try {
    const response = await makeApiRequest('verification/aadhaar_validateotp', { id_number, otp });
    
    // Check for API-specific error responses
    if (response.data.status === false) {
      console.log('API returned error:', response.data.message);
      return res.status(400).json({ 
        error: 'API Error', 
        details: response.data.message 
      });
    }
    
    return res.json({ message: 'OTP validated successfully', data: response.data });
  } catch (error: any) {
    console.error('Validate OTP API error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: 'API Error', 
        details: error.response.data 
      });
    } else if (error.request) {
      return res.status(503).json({ 
        error: 'Service Unavailable',
        details: 'No response received from the API server. Please try again later.'
      });
    } else {
      return res.status(500).json({ 
        error: 'Request Setup Error',
        details: error.message
      });
    }
  }
});

// Add a route for the root path to ensure the app works correctly
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Add a route to display the current configuration (excluding sensitive data)
app.get('/api/config-status', (req: Request, res: Response) => {
  res.json({
    apiUrl: config.API_URL,
    partnerId: config.PARTNER_ID,
    debugMode: config.DEBUG,
    serverPort: config.PORT
  });
});

// Start the server
app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
  console.log(`Open http://localhost:${config.PORT} in your browser to test KYC flow`);
});