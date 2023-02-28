import { oneLine } from 'common-tags';
import { subHours } from 'date-fns';
import type { Knex } from 'knex';
import {
  db,
  EmbedBuilder,
  env,
  ForumThread,
  Group,
  Forum,
  logger,
  MAX_EMBEDS,
  SteamAPI,
  WatcherType,
  App,
} from '@steamwatch/shared';
import SteamID from 'steamid';
import Watcher from './Watcher';
import type MessageQueue from '../MessageQueue';

const MAX_FILES = MAX_EMBEDS * MAX_EMBEDS;

type QueryResult = Forum
& {
  appId: App['id'],
  appIcon: App['icon'],
  groupId: Group['id'],
  groupAvatar: Group['avatar']
};

export default class ForumWatcher extends Watcher {
  constructor(queue: MessageQueue) {
    super(queue, 10000); // 10s
  }

  protected async work() {
    const forum = await ForumWatcher.fetchNextForum();

    if (!forum) {
      return this.pause();
    }

    logger.info({
      message: 'Checking forum threads',
      group: forum,
    });

    let page = 1;
    let threads: ForumThread[] = [];
    const groupId64 = new SteamID(`[g:1:${forum.groupId}]`).getSteamID64();
    const lastPostAt = forum.lastPost ?? subHours(new Date(), 1);
    let index = -1;

    while (threads.length < MAX_FILES && index === -1) {
      let response;

      try {
        // eslint-disable-next-line no-await-in-loop
        response = await SteamAPI.getForumThreads(
          forum.groupId,
          forum.subforumId,
          forum.type,
          page,
        );
      } catch (err) {
        logger.error({
          message: 'Unable to fetch forum threads',
          id: forum.id,
          err,
        });
        break;
      }

      if (!response || response?.length === 0) {
        break;
      }

      index = response.sort((a, b) => b.lastPostAt.getTime() - a.lastPostAt.getTime())
        .findIndex((file) => file.lastPostAt <= lastPostAt);
      threads = threads.concat(response.slice(0, index !== -1 ? index : undefined));

      // Account for pinned/locked/solved threads preventing pagination
      if (index !== -1) {
        const remaining = response.slice(index);

        if (remaining.every((thread) => thread.locked || thread.sticky || thread.solved)) {
          index = -1;
        }
      }

      page += 1;
    }

    await db('forum').update({
      lastChecked: new Date(),
      lastPost: threads[0]?.lastPostAt ?? forum.lastPost,
    })
      .where('id', forum.id);

    for (let i = threads.length - 1; i >= 0; i -= 1) {
      const thread = threads[i]!;

      logger.info({
        message: 'Found new forum post',
        thread,
      });

      if (thread.replies) {
        // eslint-disable-next-line no-await-in-loop
        const posts = await SteamAPI.getForumThreadPosts(groupId64, forum.id, thread.id);

        if (posts && Object.keys(posts.comments_raw).length) {
          const commentId = Object.keys(posts.comments_raw)[0]!;
          const post = posts.comments_raw[commentId]!;
          thread.author = post.author;
          thread.contentPreview = post.text;
          thread.url += `${thread.url.endsWith('/') ? '' : '/'}#c${commentId}`;
        }
      }

      // eventcomments have empty content previews
      thread.contentPreview = thread.contentPreview || 'N/A';

      // eslint-disable-next-line no-await-in-loop
      await this.enqueue([EmbedBuilder.createForumPost(forum, thread)], {
        forumId: forum.id,
        'watcher.type': WatcherType.Forum,
      });
    }

    return this.wait();
  }

  private static async fetchNextForum() {
    const watcherAverage = await db.avg('count AS average')
      .from((builder: Knex.QueryBuilder) => builder.count('forum_id AS count')
        .from('watcher')
        .where('watcher.type', WatcherType.Forum)
        .andWhere('inactive', false)
        .groupBy('forum_id')
        .as('innerCount'))
      .first()
      .then((res: any) => res.average || 0);

    return db.select<QueryResult>(
      'forum.*',
      { appId: 'app.id' },
      { appIcon: 'app.icon' },
      db.raw('IF(forum.app_id IS NOT NULL, app.ogg_id, `group`.id) AS group_id'),
      { groupAvatar: '`group`.avatar' },
      db.raw(
        oneLine`
        watcher_count
        + (TIMESTAMPDIFF(HOUR, IFNULL(last_checked, UTC_TIMESTAMP() - INTERVAL 1 YEAR), UTC_TIMESTAMP()) DIV ?) * ?
        AS priority
      `,
        [env.settings.watcherRunFrequency, watcherAverage],
      ),
    ).from('forum')
      .leftJoin('app', 'app.id', 'forum.app_id')
      .leftJoin('`group`', '`group`.id', 'forum.group_id')
      .innerJoin(db.select('forum_id', db.raw('COUNT(forum_id) AS watcher_count'))
        .from('watcher')
        .where('watcher.type', WatcherType.Forum)
        .andWhere('inactive', false)
        .groupBy('forumId')
        .as('watchers'), 'forum.id', 'watchers.forum_id')
      .whereRaw('last_checked <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)', [env.settings.watcherRunFrequency])
      .orWhereNull('last_checked')
      .orderBy('priority', 'desc')
      .first();
  }
}
