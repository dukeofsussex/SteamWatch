import { CommandContext, SlashCommand, SlashCreator } from 'slash-create';
import { db, EmbedBuilder, env } from '@steamwatch/shared';

export default class FreeCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'free',
      description: 'Show currently active free promotions.',
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

    const packages = await db.select(
      { appId: 'app.id' },
      { appIcon: 'app.icon' },
      { appName: 'app.name' },
      'free_package.*',
    ).from('free_package')
      .innerJoin('app', 'app.id', 'free_package.app_id')
      .where('startTime', '<', new Date())
      .andWhere('endTime', '>', new Date())
      .orderBy('startTime', 'asc');

    if (packages.length) {
      await ctx.error('No free promotions');
      return;
    }

    for (let i = 0; i < packages.length; i += 1) {
      const pkg = packages[i];

      // eslint-disable-next-line no-await-in-loop
      await ctx.embed(EmbedBuilder.createFreePackage({
        icon: pkg.appIcon,
        id: pkg.appId,
        name: pkg.appName,
      }, pkg));
    }
  }
}
