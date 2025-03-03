"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
// Initialize Express application
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Serve static files from the 'public' directory
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Helper function to generate JWT token
const generateToken = () => {
    const timestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    const reqid = (0, uuid_1.v4)(); // Unique request ID
    const payload = {
        timestamp,
        reqid,
        partnerId: config_1.config.PARTNER_ID,
    };
    try {
        // Using HS256 as the algorithm (adjust if different algorithm is required)
        return jsonwebtoken_1.default.sign(payload, config_1.config.JWT_KEY, { algorithm: 'HS256' });
    }
    catch (error) {
        console.error("Error generating JWT token:", error.message);
        throw new Error("Failed to generate authentication token");
    }
};
// Helper function to make API requests with retries and logging
function makeApiRequest(endpoint_1, data_1) {
    return __awaiter(this, arguments, void 0, function* (endpoint, data, retries = config_1.config.MAX_RETRIES) {
        var _a, _b;
        const token = generateToken();
        const url = `${config_1.config.API_URL}${endpoint}`;
        const requestConfig = {
            headers: {
                Token: token,
                Authorisedkey: config_1.config.AUTHORISED_KEY,
                'Content-Type': 'application/json',
                'User-Agent': config_1.config.PARTNER_ID,
            }
        };
        // Log the request details if debug mode is enabled
        if (config_1.config.DEBUG) {
            console.log('\n=== API Request ===');
            console.log('URL:', url);
            console.log('Headers:', JSON.stringify(requestConfig.headers, null, 2));
            console.log('Payload:', JSON.stringify(data, null, 2));
            console.log('===================\n');
        }
        try {
            const response = yield axios_1.default.post(url, data, requestConfig);
            // Log the response if debug mode is enabled
            if (config_1.config.DEBUG) {
                console.log('\n=== API Response ===');
                console.log('Status:', response.status);
                console.log('Data:', JSON.stringify(response.data, null, 2));
                console.log('====================\n');
            }
            return response;
        }
        catch (error) {
            const axiosError = error;
            if (config_1.config.DEBUG) {
                console.error('\n=== API Error ===');
                console.error('Status:', (_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.status);
                console.error('Data:', JSON.stringify((_b = axiosError.response) === null || _b === void 0 ? void 0 : _b.data, null, 2));
                console.error('================\n');
            }
            // Retry logic for specific errors
            if (retries > 0 && (!axiosError.response ||
                axiosError.response.status >= 500 ||
                axiosError.response.status === 429)) {
                console.log(`Retrying request... (${config_1.config.MAX_RETRIES - retries + 1}/${config_1.config.MAX_RETRIES})`);
                return makeApiRequest(endpoint, data, retries - 1);
            }
            throw error;
        }
    });
}
// Route to send OTP
// @ts-ignore
app.post('/send-otp', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_number } = req.body;
    // Validate input
    if (!id_number) {
        return res.status(400).json({ error: 'Aadhar number is required' });
    }
    console.log(`Sending OTP request for Aadhar: ${id_number}`);
    try {
        const response = yield makeApiRequest('verification/aadhaar_sendotp', { id_number });
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
    }
    catch (error) {
        console.error('OTP API error:', error.message);
        // Handle different types of errors
        if (error.response) {
            // The request was made and the server responded with a non-2xx status code
            return res.status(error.response.status).json({
                error: 'API Error',
                details: error.response.data
            });
        }
        else if (error.request) {
            // The request was made but no response was received
            return res.status(503).json({
                error: 'Service Unavailable',
                details: 'No response received from the API server. Please try again later.'
            });
        }
        else {
            // Something happened in setting up the request
            return res.status(500).json({
                error: 'Request Setup Error',
                details: error.message
            });
        }
    }
}));
// Route to validate OTP
// @ts-ignore
app.post('/validate-otp', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id_number, otp } = req.body;
    // Validate input
    if (!id_number || !otp) {
        return res.status(400).json({ error: 'Aadhar number and OTP are required' });
    }
    console.log(`Validating OTP for Aadhar: ${id_number}`);
    try {
        const response = yield makeApiRequest('verification/aadhaar_validateotp', { id_number, otp });
        // Check for API-specific error responses
        if (response.data.status === false) {
            console.log('API returned error:', response.data.message);
            return res.status(400).json({
                error: 'API Error',
                details: response.data.message
            });
        }
        return res.json({ message: 'OTP validated successfully', data: response.data });
    }
    catch (error) {
        console.error('Validate OTP API error:', error.message);
        if (error.response) {
            return res.status(error.response.status).json({
                error: 'API Error',
                details: error.response.data
            });
        }
        else if (error.request) {
            return res.status(503).json({
                error: 'Service Unavailable',
                details: 'No response received from the API server. Please try again later.'
            });
        }
        else {
            return res.status(500).json({
                error: 'Request Setup Error',
                details: error.message
            });
        }
    }
}));
// Add a route for the root path to ensure the app works correctly
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// Add a route to display the current configuration (excluding sensitive data)
app.get('/api/config-status', (req, res) => {
    res.json({
        apiUrl: config_1.config.API_URL,
        partnerId: config_1.config.PARTNER_ID,
        debugMode: config_1.config.DEBUG,
        serverPort: config_1.config.PORT
    });
});
// Start the server
app.listen(config_1.config.PORT, () => {
    console.log(`Server running on port ${config_1.config.PORT}`);
    console.log(`Open http://localhost:${config_1.config.PORT} in your browser to test KYC flow`);
});
