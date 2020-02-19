import fetch from 'node-fetch';

export interface SteamAppDetails {
  [key: number]: {
    success: boolean;
    data: {
      // eslint-disable-next-line camelcase
      price_overview: SteamPriceOverview;
    };
  }
}

export interface SteamPriceOverview {
  currency: string;
  initial: number;
  final: number;
  // eslint-disable-next-line camelcase
  discount_percent: number;
  // eslint-disable-next-line camelcase
  initial_formatted: string;
  // eslint-disable-next-line camelcase
  final_formatted: string;
}

export interface SteamNewsItem {
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

export default class WebApi {
  static async getAppNewsAsync(appid: number): Promise<SteamNewsItem | undefined> {
    return fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2?appid=${appid}&maxlength=1&count=1`)
      .then((res) => res.json())
      .then((res) => res.appnews.newsitems[0]);
  }

  static async GetAppPricesAsync(appids: number[], cc: string): Promise<SteamAppDetails> {
    return fetch(`https://store.steampowered.com/api/appdetails?appids=${appids.join(',')}&filters=price_overview&cc=${cc}`)
      .then((res) => res.json());
  }

  static GetIconUrl(appId: number, icon: string) {
    return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appId}/${icon}.ico`;
  }
}
