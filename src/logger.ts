import { createLogger, format, transports } from 'winston';
import env from './env';

const {
  colorize,
  combine,
  errors,
  printf,
  timestamp,
} = format;

const logFormat = combine(
  colorize({ all: true }),
  timestamp(),
  errors({ stack: true }),
  printf(({
    level, message, timestamp,
  }) => `${timestamp} [${level.toUpperCase()}]: ${message}`),
);

const logger = createLogger({
  level: env.logging.level,
  format: logFormat,
  transports: [
    new transports.File({
      dirname: 'logs',
      filename: 'error.log',
      handleExceptions: true,
      level: 'error',
    }),
  ],
});

if (env.debug) {
  logger.add(new transports.Console({
    format: logFormat,
    handleExceptions: true,
  }));
}

export default logger;
