import { oneLine } from 'common-tags';
import { RichEmbed, TextChannel } from 'discord.js';
import db from '../../db';
import logger from '../../logger';
import WebApi, { SteamPriceOverview } from '../../steam/WebApi';
import SteamWatchClient from '../../bot/structures/SteamWatchClient';
import { CURRENCIES, EMBED_COLOURS } from '../../utils/constants';
import { insertEmoji } from '../../utils/templateTags';

import Knex = require('knex');

const PRICE_FREQUENCY = 12; // 12h
const PRICE_RATE_LIMIT = 5000; // 5s

interface AppPrice {
  id: number;
  name: string;
  currencyId: number;
  currencyAbbr: string;
  currencyName: string;
  price: number;
  discountedPrice: number;
  lastChecked: Date;
}

interface AppPriceOverview extends AppPrice {
  overview: SteamPriceOverview;
}

interface AppPriceRemoval extends AppPrice {
  reason: string;
}

export default class PricesProcessor {
  private client: SteamWatchClient;

  private timeout?: NodeJS.Timeout;

  constructor(client: SteamWatchClient) {
    this.client = client;
  }

  start() {
    this.preProcess();
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  private async preProcess() {
    const average = await db.avg('count', { as: 'average' })
      .from(function innerCount(this: Knex) {
        this.count('app_id AS count')
          .from('app_watcher')
          .where('app_watcher.watch_price', true)
          .groupBy('app_id')
          .as('innerCount');
      })
      .first()
      .then((res: any) => res.average || 0);

    const appBaseQuery = db.select<AppPrice[]>(
      'app.id',
      'app.name',
      'guild.currency_id',
      { currencyAbbr: 'currency.abbreviation' },
      { currencyName: 'currency.name' },
      'app_price.price',
      'app_price.discounted_price',
      'app_price.last_checked',
      db.raw(
        oneLine`
          COUNT(*)
          + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked, NOW() - INTERVAL 1 YEAR), NOW()) DIV ?) * ?
          AS priority
        `,
        [PRICE_FREQUENCY, average],
      ),
    ).from('app')
      .innerJoin('app_watcher', 'app_watcher.app_id', 'app.id')
      .innerJoin('guild', 'guild.id', 'app_watcher.guild_id')
      .innerJoin('currency', 'currency.id', 'guild.currency_id')
      .innerJoin('app_price', function appPriceInnerJoin() {
        this.on('app_price.app_id', '=', 'app_watcher.app_id')
          .andOn('currency.id', '=', 'app_price.currency_id');
      })
      .whereRaw('last_checked <= DATE_SUB(NOW(), INTERVAL ? HOUR)', [PRICE_FREQUENCY])
      .orWhereNull('app_price.last_checked')
      .andWhere('app_watcher.watch_price', true)
      .groupBy('app.id', 'currency.abbreviation')
      .orderBy('priority', 'desc');

    const currencyId = await appBaseQuery
      .clone()
      .first()
      .then((res) => res?.currencyId || 0);

    if (currencyId === 0) {
      this.timeout = setTimeout(() => this.preProcess(), 900000);
      return;
    }

    const apps = await appBaseQuery
      .clone()
      .where('currency.id', currencyId)
      .limit(100);

    this.process(apps);
  }

  private async process(apps: AppPrice[]) {
    let prices = null;
    try {
      prices = await WebApi.GetAppPricesAsync(
        apps.map((app) => app.id),
        CURRENCIES[apps[0].currencyAbbr].cc,
      );
    } catch (err) {
      logger.error({
        group: 'Processor',
        message: err,
      });
    }

    if (!prices) {
      setTimeout(() => this.preProcess(), PRICE_RATE_LIMIT);
      return;
    }

    const changed: AppPriceOverview[] = [];
    const removed: AppPriceRemoval[] = [];
    const unchanged: AppPrice[] = [];

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i];

      if (!prices[app.id].success) {
        removed.push({
          ...app,
          reason: `No longer available in **${app.currencyAbbr}**.`,
        });
      } else if (Array.isArray(prices[app.id].data)) {
        removed.push({
          ...app,
          reason: 'App is now free-to-play.',
        });
      } else if (
        (prices[app.id].data.price_overview.discount_percent === 0
          && app.discountedPrice === app.price)
        || (prices[app.id].data.price_overview.discount_percent > 0
          && prices[app.id].data.price_overview.final === app.discountedPrice)) {
        unchanged.push(app);
      } else {
        changed.push({
          ...app,
          overview: prices[app.id].data.price_overview,
        });
      }
    }

    if (unchanged.length > 0) {
      await PricesProcessor.processUnchanged(unchanged);
    }

    if (changed.length > 0) {
      this.processChanged(changed);
    }

    if (removed.length > 0) {
      this.processRemoved(removed);
    }

    setTimeout(() => this.preProcess(), PRICE_RATE_LIMIT);
  }

  private async processChanged(apps: AppPriceOverview[]) {
    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i];

      // eslint-disable-next-line no-await-in-loop
      await db('app_price').update({
        price: app.overview.initial,
        discountedPrice: app.overview.final,
        lastChecked: new Date(),
      })
        .where({
          appId: app.id,
          currencyId: app.currencyId,
        });

      let message = '';

      if (app.overview.initial > app.price) {
        message = insertEmoji(oneLine)`
            :PRICE_UP: Base price increased to
            **${app.overview.initial_formatted}**!
          `;
      } else if (app.overview.initial < app.price) {
        message = insertEmoji(oneLine)`
            :PRICE_DOWN: Base price dropped to
            **${app.overview.initial_formatted}**!
          `;
      } else if (app.overview.final < app.discountedPrice) {
        message = insertEmoji(oneLine)`
          :ALERT: Discount:
          **${app.overview.final_formatted}**
          (-${app.overview.discount_percent}%)
        `;
      }

      if (message) {
        // eslint-disable-next-line no-await-in-loop
        await this.sendNotifications(app, message);
      }
    }
  }

  private async processRemoved(apps: AppPriceRemoval[]) {
    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i];

      // eslint-disable-next-line no-await-in-loop
      const watchers = await db.select('guild_id')
        .from('app_watcher')
        .where({
          appId: app.id,
          watchPrice: true,
        });

      watchers.forEach((watcher) => {
        const guild = this.client.guilds.get(watcher.guildId);
        guild?.owner.sendEmbed({
          color: EMBED_COLOURS.DEFAULT,
          description: insertEmoji(oneLine)`
            :ALERT: Removed a price watcher for **${app.name}**
            in **${guild.name}**.\n
            Reason: ${app.reason}`,
        });
      });
    }

    await db('app_watcher').update({
      watchPrice: false,
    })
      .whereIn('app_id', apps.map((app) => app.id))
      .andWhere('watch_price', true);

    await db.delete()
      .whereIn('app_id', apps.map((app) => app.id))
      .andWhere({
        watchNews: false,
        watchPrice: false,
      });
  }

  private static async processUnchanged(apps: AppPrice[]) {
    await db('app_price').update({ lastChecked: new Date() })
      .whereIn('app_id', apps.map((app) => app.id))
      .where('currency_id', apps[0].currencyId);
  }

  // TODO Move to a dedicated notification service once the guild count rises
  private async sendNotifications(app: AppPrice, message: string) {
    const watchers = await db.select('app_watcher.id', 'channel_id', 'entity_id', 'type')
      .from('app_watcher')
      .leftJoin('app_watcher_mention', 'app_watcher_mention.watcher_id', 'app_watcher.id')
      .where({
        appId: app.id,
        watchPrice: true,
      });

    const embed = new RichEmbed({
      color: EMBED_COLOURS.DEFAULT,
      title: `**${app.name}**`,
      description: message,
      url: `https://store.steampowered.com/app/${app.id}`,
    });

    let currentWatcherId = watchers[0].id || -1;
    let currentWatcherMentions = [];

    for (let i = 0; i <= watchers.length; i += 1) {
      const watcher = watchers[i];
      if (!watcher || currentWatcherId !== watcher.id) {
        const channel = this.client.channels
          .get(watcher
            ? watcher.channelId
            : watchers[watchers.length - 1].channelId) as TextChannel;
        channel!.send(currentWatcherMentions.join(' ') || '', { embed });

        currentWatcherId = watcher ? watcher.id : -1;
        currentWatcherMentions = [];
      }

      if (watcher && watcher.entityId) {
        currentWatcherMentions.push(`<@${watcher.type === 'role' ? '&' : ''}${watcher.entityId}>`);
      }
    }
  }
}
