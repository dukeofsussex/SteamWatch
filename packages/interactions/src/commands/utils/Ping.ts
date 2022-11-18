import { oneLine } from 'common-tags';
import {
  CommandContext,
  Message,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import { EMBED_COLOURS, env, EMOJIS } from '@steamwatch/shared';

export default class PingCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'ping',
      description: 'Check the service\'s ping to Discord.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      throttling: {
        duration: 10,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    await ctx.defer();

    const pingMsg = await ctx.send({
      embeds: [{
        color: EMBED_COLOURS.PENDING,
        description: 'Calculating...',
      }],
    }) as Message;

    ctx.editOriginal({
      embeds: [{
        color: EMBED_COLOURS.DEFAULT,
        description: oneLine`
          ${EMOJIS.PING_PONG} Pong! Latency is \`${(ctx.invokedAt - pingMsg.timestamp)}ms\`.
        `,
      }],
    });
  }
}
