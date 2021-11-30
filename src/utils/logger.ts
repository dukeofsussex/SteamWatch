import { oneLine } from 'common-tags';
import { inspect } from 'node:util';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env from './env';

const {
  colorize,
  combine,
  errors,
  metadata,
  printf,
  timestamp,
} = format;

const logFormat = combine(
  timestamp(),
  errors({ stack: true }),
  metadata({ fillExcept: ['timestamp', 'level', 'group', 'message', 'stack'] }),
  printf(({
    timestamp: ts,
    level,
    group,
    message,
    metadata: meta,
    stack,
  }) => `${oneLine`
      ${ts} [${level}]: ${(group ? `[${group}] ` : '')}
    `} ${message} ${Object.keys(meta).length ? `\n${inspect(meta)}` : ''} ${stack ? `\n${stack}` : ''}`),
);

const logger = createLogger({
  level: env.logging.level,
  transports: [
    new DailyRotateFile({
      datePattern: 'YYYY-MM-DD',
      dirname: 'logs',
      filename: '%DATE%.log',
      format: logFormat,
      handleExceptions: true,
      maxFiles: '30d',
      utc: true,
    }),
  ],
});

if (env.dev) {
  logger.add(new transports.Console({
    format: combine(
      colorize({ all: true }),
      logFormat,
    ),
    handleExceptions: true,
  }));
}

export default logger;
