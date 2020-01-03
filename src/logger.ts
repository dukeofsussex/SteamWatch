import { createLogger, format, transports } from 'winston';

const {
  colorize,
  combine,
  printf,
  timestamp,
} = format;

const logFormat = combine(
  colorize({ all: true }),
  timestamp(),
  printf(({
    level, message, timestamp,
  }) => `${timestamp} [${level.toUpperCase()}]: ${message}`),
);

const logger = createLogger({
  level: process.env.LOG_LEVEL,
  format: logFormat,
  transports: [
    new transports.File({ dirname: 'logs', filename: 'error.log', level: 'error' }),
  ],
});

if (process.env.NODE_ENV === 'DEVELOPMENT') {
  logger.add(new transports.Console({
    format: logFormat,
  }));
}

export default logger;
