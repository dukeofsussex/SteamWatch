import { stripIndents } from 'common-tags';
import {
  CommandContext,
  CommandOptionType,
  SlashCreator,
} from 'slash-create';
import {
  db,
  EMBED_COLOURS,
  EMOJIS,
  env,
  PatreonUtils,
  PATREON_ICON,
} from '@steamwatch/shared';
import { oneLine } from 'slash-create/lib/util';
import GuildOnlyCommand from '../../GuildOnlyCommand';

interface CommandArguments {
  activate?: any;
  deactivate?: any;
  set?: SetArguments;
  status?: any;
}

interface SetArguments {
  name?: string;
  avatar?: string;
}

export default class PremiumCommand extends GuildOnlyCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'premium',
      description: 'Manage premium status for your server.',
      dmPermission: false,
      ...(env.dev ? { guildIDs: [env.devGuildId] } : {}),
      options: [{
        type: CommandOptionType.SUB_COMMAND,
        name: 'activate',
        description: 'Activate your personal Patreon subscription on this server.',
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'deactivate',
        description: 'Deactivate your personal Patreon subscription on this server.',
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'status',
        description: 'Show the premium status of this server.',
      }, {
        type: CommandOptionType.SUB_COMMAND,
        name: 'set',
        description: 'Set a custom webhook name and avatar for all messages.',
        options: [{
          type: CommandOptionType.STRING,
          name: 'name',
          description: 'The webhook\'s name',
        }, {
          type: CommandOptionType.STRING,
          name: 'avatar',
          description: 'The webhook\'s avatar',
        }],
      }],
      requiredPermissions: ['MANAGE_CHANNELS'],
      throttling: {
        duration: 5,
        usages: 1,
      },
    });

    this.filePath = __filename;
  }

  override async run(ctx: CommandContext) {
    try {
      await this.setupGuild(ctx);
    } catch {
      return null;
    }

    const {
      activate,
      deactivate,
      set,
    } = ctx.options as CommandArguments;

    if (activate) {
      return PremiumCommand.activate(ctx);
    }

    if (deactivate) {
      return PremiumCommand.deactivate(ctx);
    }

    if (set) {
      return PremiumCommand.set(ctx, set);
    }

    return PremiumCommand.status(ctx);
  }

  private static async activate(ctx: CommandContext) {
    const patron = await db.select('patron.id', 'pledgeTier', 'guild.name')
      .from('patron')
      .leftJoin('guild', 'guild.id', 'patron.guild_id')
      .where('discordId', ctx.user.id)
      .first();

    if (!patron || !patron.pledgeTier) {
      return ctx.send({
        embeds: [{
          color: EMBED_COLOURS.ERROR,
          description: stripIndents`
            ${EMOJIS.ERROR} No [Patreon](https://patreon.com/steamwatch) subscription found!
            If you have a valid subscription, please contact me on my [support server](${env.discord.invite}).
          `,
        }],
        ephemeral: true,
      });
    }

    if (patron.name) {
      return ctx.send({
        embeds: [{
          color: EMBED_COLOURS.ERROR,
          description: `${EMOJIS.ERROR} Subscription already activated for **${patron.name}**!`,
        }],
        ephemeral: true,
      });
    }

    await db('patron').update({
      guildId: ctx.guildID!,
    })
      .where('id', patron.id);

    await PatreonUtils.setWatcherStates(ctx.guildID!);

    return ctx.send({
      embeds: [{
        color: EMBED_COLOURS.SUCCESS,
        description: `${EMOJIS.SUCCESS} **Tier ${patron.pledgeTier}** subscription activated!`,
      }],
      ephemeral: true,
    });
  }

  private static async deactivate(ctx: CommandContext) {
    const patron = await db.select('id', 'pledgeTier')
      .from('patron')
      .where({
        discordId: ctx.user.id,
        guildId: ctx.guildID!,
      })
      .first();

    if (!patron) {
      return ctx.send({
        embeds: [{
          color: EMBED_COLOURS.ERROR,
          description: `${EMOJIS.ERROR} No [Patreon](https://patreon.com/steamwatch) subscription activated for this server!`,
        }],
        ephemeral: true,
      });
    }

    await db('patron').update({
      guildId: null,
    })
      .where('id', patron.id);

    await PatreonUtils.setWatcherStates(ctx.guildID!);

    return ctx.send({
      embeds: [{
        color: EMBED_COLOURS.SUCCESS,
        description: `${EMOJIS.SUCCESS} **Tier ${patron.pledgeTier}** subscription deactivated!`,
      }],
      ephemeral: true,
    });
  }

  private static async set(ctx: CommandContext, { avatar, name }: SetArguments) {
    const hasTier = await db.select('id')
      .from('patron')
      .where('guildId', ctx.guildID!)
      .andWhere('pledgeTier', '>', 0)
      .first();

    if (!hasTier) {
      return ctx.send({
        embeds: [{
          color: EMBED_COLOURS.ERROR,
          description: stripIndents`
            ${EMOJIS.ERROR} Requires an activated **Tier 1** or higher subscription!
            Visit [Patreon](https://patreon.com/steamwatch) for more information.
          `,
        }],
        ephemeral: true,
      });
    }

    await db('guild').update({
      customWebhookAvatar: avatar,
      customWebhookName: name,
    })
      .where('id', ctx.guildID!);

    return ctx.send({
      embeds: [{
        color: EMBED_COLOURS.SUCCESS,
        description: `${EMOJIS.SUCCESS} Custom name and avatar set.`,
      }],
      ephemeral: true,
    });
  }

  private static async status(ctx: CommandContext) {
    const patrons = await db.select('discordId', 'pledgeTier', 'customWebhookName', 'customWebhookAvatar')
      .from('patron')
      .innerJoin('guild', 'guild.id', 'patron.guild_id')
      .where('guildId', ctx.guildID!);
    const pledgeTiers = patrons.map((patron) => patron.pledgeTier);

    return ctx.send({
      embeds: [{
        color: patrons.length ? EMBED_COLOURS.SUCCESS : EMBED_COLOURS.INACTIVE,
        title: 'Premium Status',
        timestamp: new Date(),
        thumbnail: {
          url: PATREON_ICON,
        },
        fields: [{
          name: 'Max Watchers',
          value: oneLine`
            ${env.settings.maxWatchersPerGuild}
            ${patrons.length ? `(+ **${PatreonUtils.getExtraWatchers(pledgeTiers)}**)` : ''}
          `,
        }, {
          name: 'Custom Webhook Name',
          value: patrons[0]?.customWebhookName || 'None',
        }, {
          name: 'Custom Webhook Avatar',
          value: patrons[0]?.customWebhookAvatar || 'None',
        }, {
          name: 'Patrons',
          value: patrons.map((patron) => `Tier ${patron.pledgeTier} - <@${patron.discordId}>`).join('\n') || 'None',
        }],
      }],
      ephemeral: true,
    });
  }
}
