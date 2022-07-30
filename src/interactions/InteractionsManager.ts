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
    this.creator.registerCommandsIn(join(__dirname, 'commands'), ['.ts'])
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

    this.creator.on('commandBlock', (command, ctx, reason) => logger.info({
      group: 'Interaction',
      message: `[BLOCK] "${InteractionsManager.stringifyCommand(command.commandName, ctx.options)}" : ${reason}`,
    }));

    this.creator.on('commandError', (command, err, ctx) => {
      logger.error({
        group: 'Interaction',
        message: `[ERROR] "${InteractionsManager.stringifyCommand(command.commandName, ctx.options)}""`,
        err,
      });
      ctx.error(`Uh oh, something went wrong. Please report this bug on our [Discord](${env.discord.invite}) or sacrifice your wallet to a Steam sale, maybe that'll fix it!`);
    });

    this.creator.on('commandRun', (command, _, ctx) => logger.info({
      group: 'Interaction',
      message: `[RUN] "${InteractionsManager.stringifyCommand(command.commandName, ctx.options)}"`,
    }));

    this.creator.on('error', (err) => logger.error({ group: 'Interaction', message: err.message, err }));

    this.creator.on('ping', () => logger.info({ group: 'Interaction', message: '[PING] Ponged' }));

    this.creator.once('synced', () => logger.info({
      group: 'Interaction',
      message: '[SYNC] Done',
    }));

    this.creator.on('unverifiedRequest', () => logger.warn({ group: 'Interaction', message: 'Unverified request' }));

    this.creator.on('warn', (err) => logger.warn({ group: 'Interaction', message: typeof err === 'string' ? err : err.message, err }));
  }

  private static stringifyCommand(name: string, args: object): string {
    const stringifyParams = (params: object): string => Object.entries(params)
      .reduce((prev, [k, v]) => `${prev} ${k}${(typeof v === 'object' ? ` ${stringifyParams(v)}` : `: ${v}`)}`, '')
      .trimStart();

    return `${name} ${stringifyParams(args)}`.trimEnd();
  }
}
