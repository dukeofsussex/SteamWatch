import { CommandContext, SlashCommand, SlashCreator } from 'slash-create';
import {
  db,
  EMBED_COLOURS,
  env,
  PatreonUtils,
  PATREON_ICON,
} from '@steamwatch/shared';
import { stripIndents } from 'common-tags';

export default class PremiumCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'subscription',
      description: 'Check your personal Patreon subscription status.',
      deferEphemeral: true,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      throttling: {
        duration: 5,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  // eslint-disable-next-line class-methods-use-this
  override async run(ctx: CommandContext) {
    const patron = await db.select('pledgeTier', 'guildId', 'guild.name')
      .from('patron')
      .where('discordId', ctx.user.id)
      .leftJoin('guild', 'guild.id', 'patron.guild_id')
      .first();

    return ctx.send({
      embeds: [{
        color: patron ? EMBED_COLOURS.SUCCESS : EMBED_COLOURS.INACTIVE,
        title: 'Patreon Subscription Status',
        timestamp: new Date(),
        thumbnail: {
          url: PATREON_ICON,
        },
        fields: [{
          name: 'Subscription Tier',
          value: patron ? `**Tier ${patron.pledgeTier}**` : 'None',
        }, {
          name: 'Activated Server',
          value: patron.name ? `[${patron.name}](https://discord.com/channels/${patron.guildId}/)` : 'None',
        }, {
          name: 'Rewards',
          value: stripIndents`
            ${!patron ? 'None' : ''}
            ${patron?.pledgeTier > 0 ? '- Custom Webhook Name & Avatar' : ''}
            ${patron?.pledgeTier > 1 ? `- **${PatreonUtils.getExtraWatchers([patron.pledgeTier])}** Extra Watchers` : ''}
          `,
        }],
      }],
      ephemeral: true,
    });
  }
}
