import { oneLine } from 'common-tags';
import { inspect } from 'node:util';
import { createLogger, format, transports } from 'winston';
import env from './env';

const {
  colorize,
  combine,
  errors,
  json,
  metadata,
  printf,
  timestamp,
} = format;

const baseFormat = combine(
  timestamp(),
  errors({ stack: true }),
);

const logFormat = env.dev
  ? combine(
    baseFormat,
    colorize({ all: true }),
    metadata({ fillExcept: ['timestamp', 'level', 'label', 'message', 'stack'] }),
    printf(({
      timestamp: ts,
      level,
      label,
      message,
      metadata: meta,
      stack,
    }) => `${oneLine`
        ${ts} [${level}]: ${(label ? `[${label}] ` : '')}
      `} ${message} ${Object.keys(meta).length ? `\n${inspect(meta)}` : ''} ${stack ? `\n${stack}` : ''}`),
  ) : combine(
    baseFormat,
    json(),
  );

const logger = createLogger({
  level: env.logging.level,
  transports: [
    new transports.Console({
      format: logFormat,
    }),
  ],
});

export default logger;
