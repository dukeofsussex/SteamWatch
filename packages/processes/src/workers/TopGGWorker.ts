import fetch from 'node-fetch';
import { db, env, logger } from '@steamwatch/shared';
import Worker from './Worker';

interface TopGGResponse {
  error?: string;
}

const TOPGG_ENV = {
  ...env,
  topggToken: process.env['TOPGG_TOKEN'] || '',
};

export default class TopGGWorker extends Worker {
  constructor() {
    super(1800000); // 30m
  }

  async work() {
    if (!TOPGG_ENV.topggToken) {
      logger.warn('No token set for Top.gg, stopping...');
      this.stop();
      return;
    }

    const count = await db.count('* AS count')
      .from('guild')
      .first()
      .then((res: any) => parseInt(res.count, 10));

    try {
      const res = await fetch('https://top.gg/api/bots/stats', {
        headers: {
          authorization: TOPGG_ENV.topggToken,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          server_count: count,
        }),
        method: 'POST',
      });

      const body: TopGGResponse = res.ok ? await res.json() : { error: 'Invalid response from Top.gg...' };

      logger.log({
        message: body.error || 'Status updated',
        level: body.error ? 'error' : 'debug',
      });
    } catch (err) {
      logger.error({
        message: 'Unable to post bot stats to Top.gg',
        err,
      });
    }

    this.wait();
  }
}
