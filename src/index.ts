// src/index.ts
import express, { Request, Response } from 'express';
import axios, { AxiosRequestConfig } from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { config } from './config';
import { Logger } from './logger';

// Initialize logger and Express
Logger.initialize();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Interfaces
interface AadharVerifyRequest {
  id_number: string;
  otp?: string; // Optional in production, added in testing
  client_id?: string; // Will be generated and added
}

// Configuration for testing mode
const IS_TESTING = true; // Set to false for production
const MOCK_OTP = "123456"; // Mock OTP for testing

// JWT Token Generation
const generateToken = (): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const reqid = uuidv4();
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

// API Request Helper
async function makeApiRequest(endpoint: string, data: any, token: string, retries = config.MAX_RETRIES) {
  const url = `${config.API_URL}${endpoint}`;
  
  const requestConfig: AxiosRequestConfig = {
    method: 'POST',
    url,
    headers: {
      'Token': token,
      'Authorisedkey': config.AUTHORISED_KEY,
      'Content-Type': 'application/json',
      'User-Agent': config.PARTNER_ID,
      'accept': 'application/json',
    },
    data,
  };
  
  const requestId = Logger.logRequest(url, 'POST', requestConfig.headers, data);
  
  try {
    const response = await axios(requestConfig);
    Logger.logResponse(requestId, response.status, response.data);
    return response;
  } catch (error: any) {
    Logger.logError(requestId, error);
    
    if (retries > 0 && (
      !error.response || 
      error.response.status >= 500 || 
      error.response.status === 429
    )) {
      console.log(`Retrying request... (${config.MAX_RETRIES - retries + 1}/${config.MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return makeApiRequest(endpoint, data, token, retries - 1);
    }
    
    throw error;
  }
}

// Combined Send and Validate OTP Endpoint
// @ts-ignore
app.post('/api/verify-aadhar', async (req: Request<{}, {}, AadharVerifyRequest>, res: Response) => {
  const { id_number } = req.body;
  const client_id = uuidv4(); // Generate unique client_id for this verification

  if (!id_number || !/^\d{12}$/.test(id_number)) {
    return res.status(400).json({ error: 'Valid 12-digit Aadhar number is required' });
  }

  try {
    const token = generateToken();
    const client_id = uuidv4(); // Generate unique client_id for this verification

    if (IS_TESTING) {
      console.log(`Testing mode: Processing Aadhar ${id_number} with mock OTP ${MOCK_OTP}`);
      
      // Step 1: Send OTP request with client_id
      const sendResponse = await makeApiRequest('verification/aadhaar_sendotp', 
        { 
          id_number,
          client_id 
        }, 
        token
      );
      
      if (sendResponse.status !== 200) {
        return res.status(sendResponse.status).json({
          error: 'Failed to initiate verification',
          details: sendResponse.data,
          request: {
            url: 'https://uat.paysprint.in/sprintverify-uat/api/v1/verification/aadhaar_sendotp',
            headers: {
              'Content-Type': 'application/json',
              'Token': token,
              'Authorisedkey': config.AUTHORISED_KEY,
              'User-Agent': config.PARTNER_ID
            },
            body: { id_number, client_id }
          }
        });
      }

      // Step 2: Verify with mock OTP and same client_id
      const verifyResponse = await makeApiRequest('verification/aadhaar_verifyotp', 
        { 
          id_number, 
          otp: MOCK_OTP,
          client_id 
        }, 
        token
      );
      
      if (verifyResponse.status === 200) {
        return res.json({
          message: 'Verification successful (Test Mode)',
          data: verifyResponse.data,
          mockOtp: MOCK_OTP,
          client_id,
          requestDetails: {
            sendOtp: {
              url: 'https://uat.paysprint.in/sprintverify-uat/api/v1/verification/aadhaar_sendotp',
              headers: {
                'Content-Type': 'application/json',
                'Token': token,
                'Authorisedkey': config.AUTHORISED_KEY,
                'User-Agent': config.PARTNER_ID
              },
              body: { id_number, client_id }
            },
            verifyOtp: {
              url: 'https://uat.paysprint.in/sprintverify-uat/api/v1/verification/aadhaar_verifyotp',
              headers: {
                'Content-Type': 'application/json',
                'Token': token,
                'Authorisedkey': config.AUTHORISED_KEY,
                'User-Agent': config.PARTNER_ID
              },
              body: { id_number, otp: MOCK_OTP, client_id }
            }
          }
        });
      } else {
        return res.status(verifyResponse.status).json({
          error: 'Verification failed (Test Mode)',
          details: verifyResponse.data,
          client_id,
          request: {
            url: 'https://uat.paysprint.in/sprintverify-uat/api/v1/verification/aadhaar_verifyotp',
            headers: {
              'Content-Type': 'application/json',
              'Token': token,
              'Authorisedkey': config.AUTHORISED_KEY,
              'User-Agent': config.PARTNER_ID
            },
            body: { id_number, otp: MOCK_OTP, client_id }
          }
        });
      }
    } else {
      // Production mode: Just send OTP
      const response = await makeApiRequest('verification/aadhaar_sendotp', 
        { 
          id_number,
          client_id 
        }, 
        token
      );
      
      if (response.status === 200) {
        return res.json({
          message: 'OTP sent successfully',
          data: response.data,
          client_id
        });
      } else {
        return res.status(response.status).json({
          error: 'Failed to send OTP',
          details: response.data,
          request: {
            url: 'https://uat.paysprint.in/sprintverify-uat/api/v1/verification/aadhaar_sendotp',
            headers: {
              'Content-Type': 'application/json',
              'Token': token,
              'Authorisedkey': config.AUTHORISED_KEY,
              'User-Agent': config.PARTNER_ID
            },
            body: { id_number, client_id }
          }
        });
      }
    }
  } catch (error: any) {
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;
    return res.status(status).json({
      error: 'API Error',
      details,
      request: {
        url: 'https://uat.paysprint.in/sprintverify-uat/api/v1/verification/aadhaar_sendotp',
        headers: {
          'Content-Type': 'application/json',
          'Token': '[Generated JWT]',
          'Authorisedkey': config.AUTHORISED_KEY,
          'User-Agent': config.PARTNER_ID
        },
        body: { id_number, client_id }
      }
    });
  }
});

// Debugging endpoint to view logs
app.get('/api/debug/logs', (req: Request, res: Response) => {
  res.json(Logger.getLogs());
});

// Debugging endpoint to clear logs
app.post('/api/debug/logs/clear', (req: Request, res: Response) => {
  Logger.clearLogs();
  res.json({ message: 'Logs cleared successfully' });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Config status endpoint
app.get('/api/config-status', (req: Request, res: Response) => {
  res.json({
    apiUrl: config.API_URL,
    partnerId: config.PARTNER_ID,
    debugMode: config.DEBUG,
    serverPort: config.PORT,
    testingMode: IS_TESTING
  });
});

// Start Server
app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
  console.log(`Testing mode: ${IS_TESTING}`);
  console.log(`Open http://localhost:${config.PORT} in your browser to test`);
});