import { URLSearchParams } from 'node:url';
import fetch, { RequestInit } from 'node-fetch';
import { decode } from 'html-entities';
import {
  ECurrencyCode,
  EPublishedFileQueryType,
  EPublishedFileVisibility,
  EResult,
} from 'steam-user';
import type { App, AppType, PriceType } from '../db';
import env from '../env';
import logger from '../logger';

export interface AppDetails {
  achievements?: Total;
  categories?: Tag[];
  developers?: string[];
  genres?: Tag[];
  header_image: string;
  is_free: boolean;
  name: string;
  platforms?: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  }
  publishers?: string[];
  price_overview?: PriceOverview;
  recommendations?: Total;
  release_date?: {
    coming_soon: boolean;
    date: string;
  }
  short_description?: string;
  type: AppType;
  website?: string | null;
}

export interface AppNews {
  appnews: {
    newsitems: NewsPost[];
  }
}

export interface CuratorReview {
  appId: number;
  status: 'Recommended' | 'Informational' | 'Not Recommended';
  date: Date;
  description: string;
}

export interface CuratorReviewResponse {
  success: 0 | 1;
  total_count: number;
  results_html: string;
}

export interface ForumMetadata {
  owner: string;
  type: string;
  feature: string;
  gidforum: string;
  forum_display_name: string;
  appid?: string;
}

export interface ForumResponse {
  success: 0 | 1;
  start: number;
  total: number;
  topics_html: string;
}

export interface ForumThread {
  id: string;
  author: string;
  title: string;
  contentPreview: string;
  lastPostAt: Date;
  replies: number;
  locked: boolean;
  solved: boolean;
  sticky: boolean;
  url: string;
}

export interface ForumThreadPost {
  author: string;
  text: string;
}

export interface ForumThreadPostsResponse {
  success: boolean;
  timelastpost: number;
  comments_html: string;
  comments_raw: Record<string, ForumThreadPost>;
}

export interface GroupDetails {
  success: 0 | 1;
  appid: number;
  clanAccountID: number;
  clanSteamIDString: string;
  member_count: number;
  vanity_url: string;
  is_ogg: boolean;
  is_creator_home: 0 | 1;
  is_curator: boolean;
  has_visible_store_page: boolean;
  avatar_full_url: string;
  avatar_medium_url: string;
  group_name: string;
  partner_events_enabled: boolean;
  creator_page_bg_url: string;
}

export interface GroupSummary {
  name: string;
  title: string;
  summary: string;
  avatar: string;
  memberCount: number;
  membersInChat: number;
  membersInGame: number;
  membersOnline: number;
  ownerId: string;
}

export interface KeyedAppDetails {
  [key: number]: {
    success: boolean;
    data: AppDetails;
  }
}

export interface MarketListing {
  name: string;
  hash_name: string;
  sell_listings: number;
  sell_price: number;
  app_icon: string;
  app_name: string;
  asset_description: {
    appid: number;
    icon_url: string;
    tradable: 0 | 1;
    name_color: string;
    type: string;
    market_name: string;
    market_hash_name: string;
    commodity: 0 | 1;
  }
}

export interface MarketListingPriceOverview {
  success: boolean;
  lowest_price: string;
  volume?: string;
  median_price?: string;
}

export interface MarketSearchResult {
  success: boolean;
  results: MarketListing[];
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

export interface PartnerEvent {
  gid: string;
  clanid: string;
  posterid: string;
  headline: string;
  posttime: number;
  body: string;
  banned: boolean;
}

export interface PartnerEvents {
  success: 0 | 1;
  events: {
    announcement_body: PartnerEvent;
  }[];
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

export interface ResolvedBundle {
  appids: number[];
  bundleid: number;
  name: string;
  initial_price: number;
  final_price: number;
  formatted_orig_price: string;
  formatted_final_price: string;
  discount_percent: number;
  bundle_base_discount: number;
}

export interface ResolvedSub {
  appids: number[];
  packageid: number;
  name: string;
  formatted_orig_price: string;
  orig_price_cents: number;
  formatted_final_price: string;
  final_price_cents: number;
  discount_percent: number;
}

export interface Response<T> {
  response: T;
}

export interface SearchResult {
  id: string;
  name: string;
  type: StoreAppType;
}

export interface SteamLevel {
  player_level: number;
}

export type StoreAppType = AppType | PriceType;

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

export type StoreItem = Pick<App, 'id' | 'icon' | 'name'>
& {
  type: StoreAppType;
};

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
    const res = await this.request<AppNews>(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2?appid=${appId}&count=1&feeds=steam_community_announcements,steam_community_blog`);

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

  static async getBundlePrices(bundleIds: number[], cc: string) {
    return this.request<ResolvedBundle[]>(`https://store.steampowered.com/actions/ajaxresolvebundles?bundleids=${bundleIds.join(',')}&cc=${cc}&l=english`);
  }

  static async getCuratorReviews(curatorId: number) {
    const res = await this.request<CuratorReviewResponse>(`https://store.steampowered.com/curator/${curatorId}/ajaxgetfilteredrecommendations/?count=15&sort=newreleases`);
    const reviews = res?.results_html.matchAll(/data-ds-itemkey=.*?(\d+).*?((?:Not\s)?Recommended|Informational).*?curator_review_date">(.*?)<\/.*?recommendation_desc">(.*?)<\//gs);

    return reviews
      ? [...reviews].map((review) => ({
        appId: parseInt(review[1]!, 10),
        status: review[2]!,
        date: new Date(`${review[3]!}${review[3]!.includes(',') ? '' : new Date().getFullYear()}`),
        description: review[4]!,
      })) as CuratorReview[]
      : null;
  }

  static async getEventIdForArticle(externalUrl: string) {
    const res = await fetch(externalUrl, {
      method: 'HEAD',
    });

    const urlParts = res.url.split('/');

    return urlParts[urlParts.length - 1];
  }

  static async getForumMetadata(forumUrl: string) {
    let res = null;
    let text = '';
    let metadata = null;

    try {
      res = await fetch(forumUrl);
      text = await res.text();
      metadata = text.match(/InitializeForum\(.*?,\s({.*?}),\s'.*?\)/s);
      metadata = metadata ? JSON.parse(metadata[1]!) : null;
    } catch (err) {
      logger.error({
        label: 'SteamAPI',
        message: (err as Error).message,
        res: text,
        err,
        forumUrl,
        metadata,
      });

      return null;
    }

    return metadata as ForumMetadata;
  }

  static getForumThreadPosts(groupId: string, forumId: string, threadId: string) {
    return this.request<ForumThreadPostsResponse>(`https://steamcommunity.com/comment/ForumTopic/render/${groupId}/${forumId}/`, {
      method: 'POST',
      body: new URLSearchParams({
        start: '0',
        count: '1',
        extended_data: '{"topic_permissions":{"can_view":1}}',
        feature2: threadId,
        include_raw: 'true',
      }),
    });
  }

  static async getForumThreads(
    groupId: number,
    subforumId: string,
    type: string,
    page: number = 1,
  ) {
    const res = await this.request<ForumResponse>(`https://steamcommunity.com/forum/${groupId}/${type}/render/${subforumId}/?start=${(page - 1) * 25}&count=25`);
    const threads = decode(res?.topics_html).matchAll(/data-panel=".*?class="(.*?)".*?data-gidforumtopic="(\d+)".*?_text">(.*?)<\/.*?Posted by:.*?_data">(.*?)<\/.*?href="(.*?)".*?_reply_count">.*?<.*?>.*?(\d+).*?<\/.*?data-timestamp="(\d+)".*?_name ">(.*?)<\/div/gs);

    return threads
      ? [...threads].map((thread) => ({
        author: thread[4],
        contentPreview: thread[3]!.trim(),
        id: thread[2],
        replies: parseInt(thread[6]!, 10),
        lastPostAt: new Date(parseInt(thread[7]!, 10) * 1000),
        locked: thread[1]!.includes('locked'),
        solved: thread[8]!.includes('forum_topic_answer'),
        sticky: thread[1]!.includes('sticky'),
        title: thread[8]!.replace(/<.*>/, '').trim(),
        url: thread[5],
      })) as ForumThread[]
      : null;
  }

  static getGroupAvatarHash(avatar: string) {
    return avatar.match(/\/(\w+?)_/)?.[1] ?? '';
  }

  static getGroupDetails(identifier: string | number) {
    return this.request<GroupDetails>(`https://steamcommunity.com/${(typeof identifier === 'number' ? 'gid' : 'groups')}/${identifier}/ajaxgetvanityandclanid/`);
  }

  static async getGroupNews(id: number) {
    const res = await this.request<PartnerEvents>(`https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=${id}&count=1`);

    return res?.events?.[0]?.announcement_body ?? null;
  }

  static async getGroupSummary(identifier: string | number) {
    const url = `https://steamcommunity.com/${(typeof identifier === 'number' ? 'gid' : 'groups')}/${identifier}/memberslistxml/?xml=1`;
    let res = null;
    let text = '';

    try {
      res = await fetch(url);
      text = await res.text();
    } catch (err) {
      logger.error({
        label: 'SteamAPI',
        message: (err as Error).message,
        res: text,
        err,
        url,
      });

      return null;
    }

    if (!text.startsWith('<?xml')) {
      return null;
    }

    return {
      name: this.extractXmlValue('groupName', text),
      title: this.extractXmlValue('headline', text),
      summary: this.extractXmlValue('summary', text),
      avatar: this.getGroupAvatarHash(this.extractXmlValue('avatarFull', text)),
      memberCount: parseInt(this.extractXmlValue('memberCount', text), 10),
      membersInChat: parseInt(this.extractXmlValue('membersInChat', text), 10),
      membersInGame: parseInt(this.extractXmlValue('membersInGame', text), 10),
      membersOnline: parseInt(this.extractXmlValue('membersOnline', text), 10),
      ownerId: this.extractXmlValue('steamID64', text),
    } as GroupSummary;
  }

  static async getMarketListingPriceOverview(
    appId: number,
    marketHashName: string,
    cc: ECurrencyCode,
  ) {
    const res = await this.request<MarketListingPriceOverview>(`https://steamcommunity.com/market/priceoverview/?appid=${appId}&market_hash_name=${marketHashName}&currency=${cc}`);
    return res || null;
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

  static async getSubPrices(subIds: number[], cc: string) {
    return this.request<ResolvedSub[]>(`https://store.steampowered.com/actions/ajaxresolvepackages?packageids=${subIds.join(',')}&cc=${cc}&l=english`);
  }

  static async queryFiles(appId: number) {
    const res = await this.request<Response<UGCResponse>>(`https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?key=${env.steamWebApiKey}&appid=${appId}&query_type=${EPublishedFileQueryType.RankedByPublicationDate}&return_details=true`);
    return res?.response.publishedfiledetails?.[0] || null;
  }

  static async resolveVanityUrl(vanityUrlName: string) {
    const res = await this.request<Response<VanityURLResolve>>(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${env.steamWebApiKey}&vanityurl=${vanityUrlName}`);
    return res?.response.steamid || null;
  }

  static async searchMarket(term: string, appId?: number) {
    const res = await this.request<MarketSearchResult>(`https://steamcommunity.com/market/search/render?norender=1&count=25&query=${term}${(appId ? `&appid=${appId}` : '')}`);
    return res?.results || null;
  }

  static searchStore(term: string) {
    return this.request<SearchResult[]>(`https://store.steampowered.com/search/suggest?term=${term}&cc=US&l=english&f=json`);
  }

  private static extractXmlValue(key: string, text: string) {
    const extracted = text.match(new RegExp(`<${key}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${key}>`));
    return extracted?.[1] ?? '';
  }

  private static async request<T>(url: string, options?: RequestInit): Promise<T | null> {
    let res = null;
    let text = '';

    try {
      res = await fetch(url, options);
      text = await res.text();

      return JSON.parse(text) as T;
    } catch (err) {
      logger.error({
        label: 'SteamAPI',
        message: (err as Error).message,
        res: text,
        err,
        url,
        options,
      });

      return null;
    }
  }
}
