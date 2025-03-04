import express, { Request, Response } from 'express';
import axios, { AxiosRequestConfig } from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { config } from './config';
import { Logger } from './logger';

// Initialize logger
Logger.initialize();

// Initialize Express application
const app = express();
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Define types for request bodies
interface SendAndValidateOtpRequest {
  id_number: string;
  otp?: string; // Optional OTP for immediate validation
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
    return jwt.sign(payload, config.JWT_KEY, { algorithm: 'HS256' });
  } catch (error: any) {
    console.error("Error generating JWT token:", error.message);
    throw new Error("Failed to generate authentication token");
  }
};

// Helper function to make API requests with retries and detailed logging
async function makeApiRequest(endpoint: string, data: any, token: string, retries = config.MAX_RETRIES) {
  const url = `${config.API_URL}${endpoint}`;
  
  const requestConfig: AxiosRequestConfig = {
    headers: {
      Token: token,
      Authorisedkey: config.AUTHORISED_KEY,
      'Content-Type': 'application/json',
      'User-Agent': config.PARTNER_ID,
    }
  };
  
  // Log the request
  const requestId = Logger.logRequest(url, 'POST', requestConfig.headers, data);
  
  try {
    const response = await axios.post(url, data, requestConfig);
    
    // Log the successful response
    Logger.logResponse(requestId, response.status, response.data);
    
    return response;
  } catch (error: any) {
    // Log the error
    Logger.logError(requestId, error);
    
    // Retry logic for specific errors
    if (retries > 0 && (
      !error.response || 
      error.response.status >= 500 || 
      error.response.status === 429
    )) {
      console.log(`Retrying request... (${config.MAX_RETRIES - retries + 1}/${config.MAX_RETRIES})`);
      return makeApiRequest(endpoint, data, token, retries - 1);
    }
    
    throw error;
  }
}

// Combined route to send OTP and optionally validate it with the same token
// @ts-ignore
app.post('/send-otp', async (req: Request<{}, {}, SendAndValidateOtpRequest>, res: Response) => {
  const { id_number, otp } = req.body;

  if (!id_number) {
    return res.status(400).json({ error: 'Aadhar number is required' });
  }

  console.log(`Processing request for Aadhar: ${id_number}${otp ? ' with OTP validation' : ''}`);
  
  try {
    // Generate a single token to be used for both requests
    const token = generateToken();
    
    // Step 1: Send OTP
    const sendOtpData = { id_number };
    const sendOtpResponse = await makeApiRequest('verification/aadhaar_sendotp', sendOtpData, token);
    
    if (sendOtpResponse.data.status === false) {
      console.log('Send OTP API returned error:', sendOtpResponse.data.message);
      return res.status(400).json({ 
        error: 'Send OTP API Error', 
        details: sendOtpResponse.data.message 
      });
    }

    // If OTP is not provided, return success for sending OTP
    if (!otp) {
      return res.json({ 
        message: 'OTP sent successfully'
      });
    }

    // Step 2: Validate OTP using the same token if OTP is provided
    console.log(`Validating OTP for Aadhar: ${id_number} with OTP: ${otp}`);
    const validateOtpData = { id_number, otp };
    const validateOtpResponse = await makeApiRequest('verification/aadhaar_sendotp', validateOtpData, token);
    
    if (validateOtpResponse.data.status === false) {
      console.log('Validate OTP API returned error:', validateOtpResponse.data.message);
      return res.status(400).json({ 
        error: 'Validate OTP API Error', 
        details: validateOtpResponse.data.message 
      });
    }
    
    return res.json({ 
      message: 'OTP validated successfully', 
      data: validateOtpResponse.data 
    });
  } catch (error: any) {
    console.error('API error:', error.message);
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

// Debugging endpoint to view logs
app.get('/api/debug/logs', (req, res) => {
  res.json(Logger.getLogs());
});

// Debugging endpoint to clear logs
app.post('/api/debug/logs/clear', (req, res) => {
  Logger.clearLogs();
  res.json({ message: 'Logs cleared successfully' });
});

// Root route to serve the frontend
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Config status endpoint (excluding sensitive data)
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