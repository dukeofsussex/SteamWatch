import { CommandContext, SlashCommand, SlashCreator } from 'slash-create';
import env from '../../../utils/env';

export default class SupportCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'support',
      description: 'Display the bot\'s support server invite.',
      guildIDs: env.dev ? [env.devGuildId] : undefined,
      throttling: {
        duration: 10,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  run(ctx: CommandContext) {
    return ctx.send(env.discord.invite);
  }
}
