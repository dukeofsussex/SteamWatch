import {
  ButtonStyle,
  CommandContext,
  ComponentType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import { EMOJIS, env, INVITE_URL } from '@steamwatch/shared';

export default class InviteCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'invite',
      description: 'Invite the bot to your guild.',
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
    return ctx.send({
      content: `${EMOJIS.TADA} Praise Lord Gaben!`,
      components: [{
        type: ComponentType.ACTION_ROW,
        components: [{
          type: ComponentType.BUTTON,
          style: ButtonStyle.LINK,
          label: 'Invite',
          url: INVITE_URL,
          emoji: {
            name: '\uD83D\uDCE8',
          },
        }],
      }],
    });
  }
}
