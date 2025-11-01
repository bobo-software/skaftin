import { timestamp } from 'drizzle-orm/mysql-core';
import { Request, Response } from 'express';

class ResponseUtils {
  
  // Success Response
  static success(res: Response, message: string, data: any = null, statusCode = 200) {
    console.info({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });

    return res.status(statusCode).json({
      success: true,
      message,
      ...(data && { data }),
      timestamp: new Date().toISOString()
    });
  }

  // Error Response
  static error(res: Response, message: string, error: any = null, data: any = null, statusCode = 500) {
    console.error({
      success: false,
      data: data,
      message,
      error: error instanceof Error ? error.message : error,
      timestamp: new Date().toISOString()
    });

    return res.status(statusCode).json({
      success: false,
      message,
      ...(error && { error: error instanceof Error ? error.message : error })
    });
  }
}

export default ResponseUtils;
