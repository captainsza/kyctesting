/**
 * Logger utility for API debugging
 */
export class Logger {
  private static lastRequestId = 0;
  private static logs: Array<{id: number, timestamp: string, type: string, message: string, data?: any}> = [];
  private static readonly MAX_LOGS = 50; // Keep only the last 50 logs in memory

  /**
   * Log a request with detailed information
   */
  static logRequest(url: string, method: string, headers: any, data?: any): number {
    const requestId = ++Logger.lastRequestId;
    const timestamp = new Date().toISOString();
    
    // Format headers for better readability, hiding sensitive info
    const sanitizedHeaders = { ...headers };
    
    // Hide sensitive information in headers
    if (sanitizedHeaders.Authorization) {
      sanitizedHeaders.Authorization = '[HIDDEN]';
    }
    if (sanitizedHeaders.Token) {
      sanitizedHeaders.Token = sanitizedHeaders.Token.substring(0, 10) + '...[HIDDEN]';
    }
    if (sanitizedHeaders.Authorisedkey) {
      sanitizedHeaders.Authorisedkey = sanitizedHeaders.Authorisedkey.substring(0, 10) + '...[HIDDEN]';
    }
    
    const message = `[REQ #${requestId}] ${method} ${url}`;
    const logEntry = {
      id: requestId,
      timestamp,
      type: 'REQUEST',
      message,
      data: {
        headers: sanitizedHeaders,
        body: data
      }
    };
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(message);
    console.log('Timestamp:', timestamp);
    console.log('Headers:', JSON.stringify(sanitizedHeaders, null, 2));
    
    if (data) {
      console.log('Body:', JSON.stringify(data, null, 2));
    }
    
    this.addLog(logEntry);
    return requestId;
  }

  /**
   * Log a successful response
   */
  static logResponse(requestId: number, status: number, data: any): void {
    const timestamp = new Date().toISOString();
    const message = `[RES #${requestId}] Status: ${status}`;
    const logEntry = {
      id: requestId,
      timestamp,
      type: 'RESPONSE',
      message,
      data: {
        status,
        body: data
      }
    };
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(message);
    console.log('Timestamp:', timestamp);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    this.addLog(logEntry);
  }

  /**
   * Log an error response
   */
  static logError(requestId: number, error: any): void {
    const timestamp = new Date().toISOString();
    const status = error.response?.status || 'No Status';
    const message = `[ERR #${requestId}] Status: ${status}`;
    
    let errorData: any = {
      message: error.message
    };
    
    if (error.response) {
      errorData.status = error.response.status;
      errorData.data = error.response.data;
    }
    
    const logEntry = {
      id: requestId,
      timestamp,
      type: 'ERROR',
      message,
      data: errorData
    };
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(message);
    console.log('Timestamp:', timestamp);
    console.log('Error Message:', error.message);
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('No response received. Request details:', error.request);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    this.addLog(logEntry);
  }

  /**
   * Add a log entry to the memory store
   */
  private static addLog(log: any): void {
    this.logs.push(log);
    
    // Trim logs if we exceed the maximum
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  /**
   * Get all logs
   */
  static getLogs(): any[] {
    return this.logs;
  }

  /**
   * Clear all logs
   */
  static clearLogs(): void {
    this.logs = [];
  }
}
