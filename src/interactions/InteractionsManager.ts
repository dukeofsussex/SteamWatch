import { FastifyServer, SlashCreator } from 'slash-create';
import { join } from 'path';
import './CommandContextExtensions';
import env from '../utils/env';
import logger from '../utils/logger';
import { Manager } from '../types';

export default class InteractionsManager implements Manager {
  private creator: SlashCreator;

  constructor() {
    this.creator = new SlashCreator({
      applicationID: env.discord.appId,
      publicKey: env.discord.publicKey,
      token: env.discord.token,
    });
  }

  async start() {
    this.registerEvents();
    this.creator.registerCommandsIn({
      filter: /^([^.].*)\.(?:js|ts)$/,
      dirname: join(__dirname, 'commands'),
    })
      .syncCommands()
      .withServer(new FastifyServer())
      .startServer();
  }

  // eslint-disable-next-line class-methods-use-this
  stop() {}

  private async registerEvents() {
    if (env.debug) {
      this.creator.on('debug', (message) => logger.debug({ group: 'Interaction', message }));
    }

    this.creator.on('commandBlock', (command, _, reason) => logger.info({
      group: 'Interaction',
      message: `[BLOCK] "${command.commandName}" : ${reason}`,
    }));

    this.creator.on('commandError', (command, err, ctx) => {
      logger.error({
        group: 'Interaction',
        message: `[ERROR] "${command.commandName}" : ${err}\n${err.stack}`,
      });
      ctx.error('Uh oh, something went wrong. Quick, sacrifice your wallet to a Steam sale, maybe that\'ll fix it!');
    });

    this.creator.on('commandRun', (command) => logger.info({
      group: 'Interaction',
      message: `[RUN] "${command.commandName}"`,
    }));

    this.creator.on('error', (err) => logger.error({ group: 'Interaction', message: err.message, meta: { err } }));

    this.creator.on('ping', () => logger.info({ group: 'Interaction', message: '[PING] Ponged' }));

    this.creator.once('synced', () => logger.info({
      group: 'Interaction',
      message: '[SYNC] Done',
    }));

    this.creator.on('unverifiedRequest', (req) => logger.error({ group: 'Interaction', message: 'Unverified request', meta: { req } }));

    this.creator.on('warn', (err) => logger.warn({ group: 'Interaction', message: typeof err === 'string' ? err : err.message, meta: { err } }));
  }
}
