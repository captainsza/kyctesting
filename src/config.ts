export const config = {
  // API credentials
  JWT_KEY: 'UTA5U1VEQXdNREF4VFZSSmVnVUWVPpPZWxVd1RuYzlQUT09',
  PARTNER_ID: 'CORP00001',
  AUTHORISED_KEY: 'TVRJekSEVTJOelUwTnpKRFQxSIFNREF3TURFPQ==',
  API_URL: 'https://uat.paysprint.in/sprintverify-uat/api/v1/',
  
  // Server configuration
  PORT: process.env.PORT || 3000,
  
  // Debug mode - set to true to see detailed request/response logs
  DEBUG: true,
  
  // Maximum number of retry attempts for API calls
  MAX_RETRIES: 2,
  
  // NOTE: Replace the above credential values with the actual ones from your documentation
  // The current values may be incorrect or formatted improperly
}
