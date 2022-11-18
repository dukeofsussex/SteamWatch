import { CommandContext, SlashCommand, SlashCreator } from 'slash-create';
import { env } from '@steamwatch/shared';

export default class SupportCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'support',
      description: 'Display the bot\'s support server invite.',
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      throttling: {
        duration: 10,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override run(ctx: CommandContext) {
    return ctx.send(env.discord.invite);
  }
}
