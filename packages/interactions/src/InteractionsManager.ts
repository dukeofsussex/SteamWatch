import { join } from 'node:path';
import fastify from 'fastify';
import { FastifyServer, SlashCreator } from 'slash-create';
import { env, logger, Manager } from '@steamwatch/shared';
import './CommandContextExtensions';

export default class InteractionsManager implements Manager {
  private creator: SlashCreator;

  constructor() {
    this.creator = new SlashCreator({
      applicationID: env.discord.appId,
      publicKey: env.discord.publicKey,
      token: env.discord.token,
      serverHost: env.server.host,
      serverPort: env.server.port,
    });
  }

  async start() {
    this.registerEvents();

    const server = fastify();
    server.get('/status', async () => ({ status: 'OK' }));

    this.creator.registerCommandsIn(join(__dirname, 'commands'), ['.ts'])
      .syncCommands()
      .withServer(new FastifyServer(server))
      .startServer();
  }

  // eslint-disable-next-line class-methods-use-this
  stop() {}

  private async registerEvents() {
    if (env.debug) {
      this.creator.on('debug', (message) => logger.debug({
        label: 'Interaction:debug',
        message,
      }));
    }

    this.creator.on('commandBlock', (command, ctx, reason) => logger.info({
      label: 'Interaction:commandBlock',
      message: `${InteractionsManager.stringifyCommand(command.commandName, ctx.options)}`,
      reason,
    }));

    this.creator.on('commandError', (command, err, ctx) => {
      logger.error({
        label: 'Interaction:commandError',
        message: `${InteractionsManager.stringifyCommand(command.commandName, ctx.options)}`,
        err,
      });
      ctx.error(`Uh oh, something went wrong. Please report this bug on our [Discord](${env.discord.invite}) or sacrifice your wallet to a Steam sale, maybe that'll fix it!`);
    });

    this.creator.on('commandRun', (command, _, ctx) => logger.info({
      label: 'Interaction:commandRun',
      message: `${InteractionsManager.stringifyCommand(command.commandName, ctx.options)}`,
    }));

    this.creator.on('error', (err) => logger.error({
      label: 'Interaction:error',
      message: err.message,
      err,
    }));

    this.creator.on('ping', () => logger.info({
      label: 'Interaction:ping',
      message: 'Ponged',
    }));

    this.creator.once('synced', () => logger.info({
      label: 'Interaction:synced',
      message: '[SYNC] Done',
    }));

    this.creator.on('unverifiedRequest', () => logger.warn({
      label: 'Interaction:unverifiedRequest',
      message: 'Unverified request',
    }));

    this.creator.on('warn', (err) => logger.warn({
      label: 'Interaction:warn',
      message: typeof err === 'string' ? err : err.message,
      err,
    }));
  }

  private static stringifyCommand(name: string, args: object): string {
    const stringifyParams = (params: object): string => Object.entries(params)
      .reduce((prev, [k, v]) => `${prev} ${k}${(typeof v === 'object' ? ` ${stringifyParams(v)}` : `: ${v}`)}`, '')
      .trimStart();

    return `${name} ${stringifyParams(args)}`.trimEnd();
  }
}
