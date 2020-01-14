import fetch from 'node-fetch';

interface SteamNewsItem {
  appid: number;
  author: string;
  date: number;
  feedlabel: string;
  feedname: string;
  // eslint-disable-next-line camelcase
  feed_type: number;
  gid: string;
  // eslint-disable-next-line camelcase
  is_external_url: boolean;
  title: string;
  url: string;
}

class WebApi {
  static async getAppNewsAsync(appid: number): Promise<SteamNewsItem | undefined> {
    return fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2?appid=${appid}&maxlength=1&count=1`)
      .then((res) => res.json())
      .then((res) => res.appnews.newsitems[0]);
  }
}

export default WebApi;
