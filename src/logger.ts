import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env from './env';

const {
  colorize,
  combine,
  errors,
  printf,
  timestamp,
} = format;

const logFormat = combine(
  timestamp(),
  errors({ stack: true }),
  printf((info) => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`),
);

const logger = createLogger({
  level: env.logging.level,
  format: logFormat,
  transports: [
    new DailyRotateFile({
      datePattern: 'YYYY-MM-DD',
      dirname: 'logs',
      filename: '%DATE%.log',
      handleExceptions: true,
      level: 'warn',
      format: logFormat,
      maxFiles: '30d',
      utc: true,
    }),
  ],
});

if (env.debug) {
  logger.add(new transports.Console({
    format: combine(
      colorize({ all: true }),
      logFormat,
    ),
    handleExceptions: true,
  }));
}

export default logger;
