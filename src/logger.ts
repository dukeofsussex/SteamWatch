import { oneLine, stripIndent } from 'common-tags';
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
  printf(({
    timestamp: ts,
    level,
    group,
    message,
    stack,
  }) => stripIndent`
    ${oneLine`
      ${ts}
      [${level.toUpperCase()}]:
      ${(group ? `[${group}] ` : '')}
    `} ${message} ${stack ? `\n${stack}` : ''}
  `),
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
      level: 'info',
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
