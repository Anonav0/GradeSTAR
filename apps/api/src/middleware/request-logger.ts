import type { IncomingMessage } from 'node:http';
import { pinoHttp, type HttpLogger } from 'pino-http';
import type { Logger } from '@gradestar/logging';
import type { Request } from 'express';

export interface RequestLoggerOptions {
  logger: Logger;
  ignorePaths?: string[];
}

/**
 * Creates structured HTTP request logging middleware using pino-http.
 * Redacts sensitive headers, strips sensitive query parameters from URLs,
 * and attaches the correlated requestId to all log entries.
 */
export function createRequestLogger(options: RequestLoggerOptions): HttpLogger {
  const ignorePaths = new Set(
    options.ignorePaths ?? ['/health', '/ready', '/api/v1/health', '/api/v1/ready'],
  );

  return pinoHttp({
    logger: options.logger,
    genReqId: (req: IncomingMessage) => {
      const expressReq = req as Request;
      return expressReq.id || expressReq.requestId || (req.headers['x-request-id'] as string);
    },
    customProps: (req: IncomingMessage) => {
      const expressReq = req as Request;
      return {
        requestId: expressReq.id || expressReq.requestId,
      };
    },
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: {
      ignore: (req) => {
        const url = req.url?.split('?')[0];
        return url ? ignorePaths.has(url) : false;
      },
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url?.split('?')[0], // Sanitized path without sensitive query parameters
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length'],
          'x-request-id': req.headers['x-request-id'],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  });
}
