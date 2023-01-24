import { formatDuration, intervalToDuration } from 'date-fns';
import {
  ButtonStyle,
  CommandContext,
  ComponentType,
  SlashCommand,
  SlashCreator,
} from 'slash-create';
import {
  db,
  DiscordAPI,
  EMBED_COLOURS,
  env,
  INVITE_URL,
  REPO_URL,
  VERSION,
  WEBSITE_URL,
} from '@steamwatch/shared';

export default class InfoCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'info',
      description: 'Display information about the bot.',
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
    const countQuery = db.count('* AS count')
      .first();

    const counts = await Promise.all([
      countQuery.clone()
        .from('guild')
        .whereNot('id', 0)
        .then((res: any) => res.count),
      db.countDistinct('app_id AS count')
        .from('watcher')
        .whereNotNull('appId')
        .first()
        .then((res: any) => res.count),
      db.countDistinct('ugc_id AS count')
        .from('watcher')
        .whereNotNull('ugcId')
        .first()
        .then((res: any) => res.count),
      countQuery.clone()
        .from('watcher')
        .then((res: any) => res.count),
    ]);

    ctx.send({
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
        }, {
          type: ComponentType.BUTTON,
          style: ButtonStyle.LINK,
          label: 'GitHub Repo',
          url: REPO_URL,
        }, {
          type: ComponentType.BUTTON,
          style: ButtonStyle.LINK,
          label: 'Patreon',
          url: 'https://patreon.com/steamwatch',
        }, {
          type: ComponentType.BUTTON,
          style: ButtonStyle.LINK,
          label: 'Support',
          url: env.discord.invite,
        }, {
          type: ComponentType.BUTTON,
          style: ButtonStyle.LINK,
          label: 'Website',
          url: WEBSITE_URL,
        }],
      }],
      embeds: [
        {
          title: 'SteamWatch Statistics',
          url: WEBSITE_URL,
          color: EMBED_COLOURS.DEFAULT,
          timestamp: new Date(),
          // TODO Account for missing avatar
          // @ts-ignore
          footer: {
            icon_url: (await DiscordAPI.getCurrentUser()).avatarUrl,
            text: `SteamWatch v${VERSION}`,
          },
          fields: [
            {
              name: 'Guilds',
              value: counts[0],
              inline: true,
            },
            {
              name: 'Apps',
              value: counts[1],
              inline: true,
            },
            {
              name: 'UGC',
              value: counts[2],
              inline: true,
            },
            {
              name: 'Watchers',
              value: counts[3],
              inline: true,
            },
            {
              name: 'Uptime',
              value: formatDuration(intervalToDuration({ start: 0, end: process.uptime() * 1000 })),
              inline: false,
            },
          ],
        },
      ],
    });
  }
}
