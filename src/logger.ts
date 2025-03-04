// src/logger.ts
import { v4 as uuidv4 } from 'uuid';

export class Logger {
  private static logs: any[] = [];

  static initialize() {
    console.log('Logger initialized');
  }

  static logRequest(url: string, method: string, headers: any, body: any): string {
    const requestId = uuidv4();
    const logEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      type: 'request',
      url,
      method,
      headers,
      body
    };
    this.logs.push(logEntry);
    return requestId;
  }

  static logResponse(requestId: string, status: number, data: any) {
    const logEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      type: 'response',
      status,
      data
    };
    this.logs.push(logEntry);
  }

  static logError(requestId: string, error: any) {
    const logEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      type: 'error',
      error: error.message,
      details: error.response?.data || error
    };
    this.logs.push(logEntry);
  }

  static getLogs() {
    return this.logs;
  }

  static clearLogs() {
    this.logs = [];
  }
}