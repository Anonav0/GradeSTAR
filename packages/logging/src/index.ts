import pino, { type Logger, type LoggerOptions } from 'pino';

export interface LoggerConfig {
  serviceName: string;
  logLevel?: string;
  isProduction?: boolean;
}

/**
 * Creates a structured Pino logger tailored for GradeSTAR services.
 */
export function createLogger(config: LoggerConfig): Logger {
  const isProduction = config.isProduction ?? process.env['NODE_ENV'] === 'production';
  const level = config.logLevel || process.env['LOG_LEVEL'] || (isProduction ? 'info' : 'debug');

  const options: LoggerOptions = {
    name: config.serviceName,
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (!isProduction && process.env['NODE_ENV'] !== 'test') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

export type { Logger } from 'pino';
