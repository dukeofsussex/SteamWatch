import fetch from 'node-fetch';

export interface SteamAppDetails {
  [key: number]: {
    success: boolean;
    data: {
      price_overview: SteamPriceOverview;
    };
  }
}

export interface SteamPriceOverview {
  currency: string;
  initial: number;
  final: number;
  discount_percent: number;
  initial_formatted: string;
  final_formatted: string;
}

export interface SteamNewsItem {
  appid: number;
  author: string;
  contents: string;
  date: number;
  feedlabel: string;
  feedname: string;
  feed_type: number;
  gid: string;
  is_external_url: boolean;
  title: string;
  url: string;
}

export default class WebApi {
  static async getAppNewsAsync(appId: number): Promise<SteamNewsItem | undefined> {
    return fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2?appid=${appId}&count=1`)
      .then((res) => res.json())
      .then((res) => res.appnews.newsitems[0]);
  }

  static async getAppPricesAsync(appIds: number[], cc: string): Promise<SteamAppDetails> {
    return fetch(`https://store.steampowered.com/api/appdetails?appids=${appIds.join(',')}&filters=price_overview&cc=${cc}`)
      .then((res) => res.json());
  }

  static getNewsImage(image: string) {
    return image.replace(/\{STEAM_CLAN(?:_LOC)?_IMAGE\}/, 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans');
  }

  static getIconUrl(appId: number, icon: string) {
    return `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appId}/${icon}.jpg`;
  }

  static getStoreUrl(appId: number) {
    return `https://store.steampowered.com/app/${appId}`;
  }
}
