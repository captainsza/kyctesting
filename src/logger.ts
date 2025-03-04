/**
 * Enhanced Logger utility for API debugging with file output
 */
import fs from 'fs';
import path from 'path';
import { format as formatDate } from 'date-fns';

export class Logger {
  private static lastRequestId = 0;
  private static logs: Array<{ id: number, timestamp: string, type: string, message: string, data?: any }> = [];
  private static readonly MAX_LOGS = 100; // Keep last 100 logs in memory
  private static logDir = path.join(__dirname, '../logs');
  private static logFile = path.join(Logger.logDir, `api_${formatDate(new Date(), 'yyyyMMdd')}.log`);
  
  /**
   * Initialize the logger and create log directory if it doesn't exist
   */
  static initialize(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    const startupMessage = `\n========== KYC API Logger Started at ${new Date().toISOString()} ==========\n\n`;
    fs.appendFileSync(this.logFile, startupMessage);
    console.log(`Logger initialized. Writing logs to: ${this.logFile}`);
  }

  /**
   * Log a request with all details
   */
  static logRequest(url: string, method: string, headers: any, data?: any): number {
    const requestId = ++Logger.lastRequestId;
    const timestamp = new Date().toISOString();
    
    const headerJson = JSON.stringify(headers, null, 2);
    const dataJson = data ? JSON.stringify(data, null, 2) : 'null';
    
    const logMessage = [
      `\n━━━━━━━━━━━━━━━━ REQUEST #${requestId} ━━━━━━━━━━━━━━━━`,
      `Timestamp: ${timestamp}`,
      `Method: ${method}`,
      `URL: ${url}`,
      `Headers: ${headerJson}`,
      `Body: ${dataJson}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    ].join('\n');
    
    console.log(logMessage);
    try {
      fs.appendFileSync(this.logFile, logMessage);
    } catch (err) {
      console.error('Error writing to log file:', err);
    }
    
    this.addLog({
      id: requestId,
      timestamp,
      type: 'REQUEST',
      message: `[REQ #${requestId}] ${method} ${url}`,
      data: { headers, body: data }
    });
    
    return requestId;
  }

  /**
   * Log a successful response with all details
   */
  static logResponse(requestId: number, status: number, data: any): void {
    const timestamp = new Date().toISOString();
    const dataJson = JSON.stringify(data, null, 2);
    
    const logMessage = [
      `\n━━━━━━━━━━━━━━━━ RESPONSE #${requestId} ━━━━━━━━━━━━━━━━`,
      `Timestamp: ${timestamp}`,
      `Status: ${status}`,
      `Response Body: ${dataJson}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    ].join('\n');
    
    console.log(logMessage);
    try {
      fs.appendFileSync(this.logFile, logMessage);
    } catch (err) {
      console.error('Error writing to log file:', err);
    }
    
    this.addLog({
      id: requestId,
      timestamp,
      type: 'RESPONSE',
      message: `[RES #${requestId}] Status: ${status}`,
      data: { status, body: data }
    });
  }

  /**
   * Log an error response with all details
   */
  static logError(requestId: number, error: any): void {
    const timestamp = new Date().toISOString();
    const status = error.response?.status || 'No Status';
    
    let logParts = [
      `\n━━━━━━━━━━━━━━━━ ERROR #${requestId} ━━━━━━━━━━━━━━━━`,
      `Timestamp: ${timestamp}`,
      `Status: ${status}`,
      `Error Message: ${error.message}`
    ];
    
    if (error.response) {
      logParts.push(`Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      logParts.push(`No response received. Request details: ${error.request}`);
    }
    
    logParts.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    const logMessage = logParts.join('\n');
    
    console.log(logMessage);
    try {
      fs.appendFileSync(this.logFile, logMessage);
    } catch (err) {
      console.error('Error writing to log file:', err);
    }
    
    this.addLog({
      id: requestId,
      timestamp,
      type: 'ERROR',
      message: `[ERR #${requestId}] Status: ${status}`,
      data: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      }
    });
  }

  /**
   * Add a log entry to the memory store
   */
  private static addLog(log: any): void {
    this.logs.push(log);
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