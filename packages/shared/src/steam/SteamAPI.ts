import { URLSearchParams } from 'node:url';
import fetch, { RequestInit } from 'node-fetch';
import { EPublishedFileQueryType, EPublishedFileVisibility, EResult } from 'steam-user';
import env from '../env';
import logger from '../logger';

export type AppType = 'application' | 'config' | 'dlc' | 'game' | 'music' | 'package' | 'series' | 'video';

export interface AppDetails {
  achievements?: Total;
  categories?: Tag[];
  developers: string[];
  genres?: Tag[];
  header_image: string;
  is_free: boolean;
  name: string;
  platforms: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  }
  publishers?: string[];
  price_overview?: PriceOverview;
  recommendations?: Total;
  release_date: {
    coming_soon: boolean;
    date: string;
  }
  short_description: string;
  type: AppType;
  website: string | null;
}

export interface AppNews {
  appnews: {
    newsitems: NewsPost[];
  }
}

export interface KeyedAppDetails {
  [key: number]: {
    success: boolean;
    data: AppDetails;
  }
}

export interface NewsPost {
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

export interface NumberOfCurrentPlayers {
  player_count: number;
}

export interface OwnedGame {
  appid: number;
}

export interface OwnedGames {
  games: OwnedGame[];
}

export interface PlayerAlias {
  newname: string;
}

export interface PlayerBans {
  CommunityBanned: boolean;
  DaysSinceLastBan: number;
  EconomyBan: string;
  NumberOfGameBans: number;
  NumberOfVACBans: number;
  VACBanned: boolean;
}

export interface PlayersResponse<T> {
  players: T[];
}

export interface PlayerSummary {
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  communityvisibilitystate: number;
  lastlogoff: number;
  loccountrycode?: string;
  personaname: string;
  profilestate: number;
  profileurl: string;
  steamid: string;
}

export interface PriceOverview {
  currency: string;
  initial: number;
  final: number;
  discount_percent: number;
  initial_formatted: string;
  final_formatted: string;
}

export interface Response<T> {
  response: T;
}

export interface SearchResult {
  total: number;
  items: {
    id: number;
    name: string;
  }[];
}

export interface SteamLevel {
  player_level: number;
}

export interface Tag {
  description: string;
}

export interface Total {
  total: number;
}

export interface SteamUGC {
  publishedfileid: string;
  result: EResult;
  creator: string;
  consumer_app_id: number;
  preview_url: string;
  title: string;
  description: string;
  time_created: number;
  time_updated: number;
  visibility: EPublishedFileVisibility
  banned: boolean;
  ban_reason: string;
  subscriptions: number;
  favorited: number;
  lifetime_subscriptions: number;
  lifetime_favorited: number;
  views: number;
  tags: {
    tag: string;
  }[];
}

export interface UGCResponse {
  publishedfiledetails: SteamUGC[];
}

export interface VanityURLResolve {
  steamid?: string;
}

const APP_ID_REGEX = /app\/(\d+)/;

export default class SteamAPI {
  static async getAppDetails(appId: number, cc: string) {
    const res = await this.request<KeyedAppDetails>(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${cc}`);
    return res?.[appId]?.data ?? null;
  }

  static async getAppNews(appId: number) {
    const res = await this.request<AppNews>(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2?appid=${appId}&count=1`);

    if (!res?.appnews?.newsitems?.[0]) {
      return null;
    }

    const post = res!.appnews.newsitems[0];
    post.url = encodeURI(post.url);
    return post;
  }

  static async getAppPrices(appIds: number[], cc: string) {
    return this.request<KeyedAppDetails>(`https://store.steampowered.com/api/appdetails?appids=${appIds.join(',')}&filters=price_overview&cc=${cc}`);
  }

  static async getEventIdForArticle(externalUrl: string) {
    const res = await fetch(externalUrl, {
      method: 'HEAD',
    });

    const urlParts = res.url.split('/');

    return urlParts[urlParts.length - 1];
  }

  static async getNumberOfCurrentPlayers(appId: number) {
    const res = await this.request<Response<NumberOfCurrentPlayers>>(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`);
    return res?.response.player_count || null;
  }

  static async getOwnedGames(steamId: string) {
    const res = await this.request<Response<OwnedGames>>(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${env.steamWebApiKey}&steamid=${steamId}&include_played_free_games=true`);
    return res?.response.games || null;
  }

  static async getPlayerAliases(steamId: string) {
    const res = await this.request<PlayerAlias[]>(`https://steamcommunity.com/profiles/${steamId}/ajaxaliases`);
    return res || [];
  }

  static async getPlayerBans(steamId: string) {
    const res = await this.request<PlayersResponse<PlayerBans>>(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${env.steamWebApiKey}&steamids=${steamId}`);
    return res?.players[0] || null;
  }

  static async getPlayerSummary(steamId: string) {
    const res = await this.request<Response<PlayersResponse<PlayerSummary>>>(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${env.steamWebApiKey}&steamids=${steamId}`);
    return res?.response.players[0] || null;
  }

  static async getPublishedFileDetails(ids: string[]) {
    const res = await this.request<Response<UGCResponse>>('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', {
      method: 'POST',
      body: new URLSearchParams({
        itemcount: ids.length.toString(),
        ...ids.reduce((prev, id, i) => ({ ...prev, [`publishedfileids[${i}]`]: id.toString() }), {}),
      }),
    });
    return res?.response.publishedfiledetails || null;
  }

  static async getRandom() {
    const res = await fetch('http://store.steampowered.com/explore/random/', {
      method: 'HEAD',
    });

    const appId = res.url.match(APP_ID_REGEX)?.[1];

    return appId ? parseInt(appId, 10) : null;
  }

  static async getSteamLevel(steamId: string) {
    const res = await this.request<Response<SteamLevel>>(`https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${env.steamWebApiKey}&steamid=${steamId}`);
    return res?.response.player_level || null;
  }

  static async queryFiles(appId: number) {
    const res = await this.request<Response<UGCResponse>>(`https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?key=${env.steamWebApiKey}&appid=${appId}&query_type=${EPublishedFileQueryType.RankedByPublicationDate}&return_details=true`);
    return res?.response.publishedfiledetails?.[0] || null;
  }

  static async resolveVanityUrl(vanityUrlName: string) {
    const res = await this.request<Response<VanityURLResolve>>(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${env.steamWebApiKey}&vanityurl=${vanityUrlName}`);
    return res?.response.steamid || null;
  }

  static async searchStore(term: string) {
    const res = await this.request<SearchResult>(`https://store.steampowered.com/api/storesearch/?term=${term}&cc=US`);
    return res?.total ? res.items : null;
  }

  private static async request<T>(url: string, options?: RequestInit): Promise<T | null> {
    try {
      const res = await fetch(url, options);
      return await res.json() as T;
    } catch (err) {
      logger.error({
        label: 'SteamAPI',
        message: (err as Error).message,
        err,
        url,
        options,
      });
      return null;
    }
  }
}
