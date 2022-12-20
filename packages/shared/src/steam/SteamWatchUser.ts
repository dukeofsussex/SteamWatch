/// <reference path="./steam-user.d.ts" />
import SteamUser from 'steam-user';
import EMsg from 'steam-user/enums/EMsg';
import Schema from 'steam-user/protobufs/generated/_load';

/* eslint-disable @typescript-eslint/naming-convention */
declare module 'steam-user' {
  function _encodeProto(proto: object, data: object): Buffer;
  function _decodeProto(proto: object, encoded: Buffer | ByteBuffer): object;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface ChangeHistory {
  changes: ChangeLog[];
  total: number;
}

export interface ChangeLog {
  timestamp: number;
  change_description: string;
}

// EWorkshopFileType is lacking
export enum FileType {
  Normal = 0,
  Microtransaction = 1,
  Collection = 2,
  Art = 3,
  Video = 4,
  Screenshot = 5,
  // Skip 6-8: unused
  WebGuide = 9,
  IntegratedGuide = 10,
  Merch = 11,
  ControllerBinding = 12,
  // Skip 13: internal
  SteamVideo = 14,
  GameManagedItem = 15,
}

export interface PublishedFile {
  result: SteamUser.EResult;
  publishedfileid: string;
  creator: string;
  consumer_appid: number;
  file_size: string;
  preview_url: string;
  title: string;
  file_description: string;
  time_created: number;
  time_updated: number;
  visibility: SteamUser.EPublishedFileVisibility
  banned: boolean;
  ban_reason: string;
  file_type: FileType;
  subscriptions: number;
  favorited: number;
  lifetime_subscriptions: number;
  lifetime_favorited: number;
  views: number;
  tags: {
    tag: string;
    display_name: string;
  }[];
}

export interface QueryFilesResponse {
  total: number;
  publishedfiledetails: PublishedFile[];
  next_cursor: string;
}

export default class SteamWatchUser extends SteamUser {
  connected = false;

  // TODO Determine whether needed
  // getTags(): Promise<ChangeHistory> {
  //   const data = {
  //     tagids: [19],
  //     language: 'english',
  //   };
  //   const header = {
  //     msg: 151,
  //     proto: {
  //       target_job_name: 'Store.GetLocalizedNameForTags#1',
  //     },
  //   };

  //   return new Promise((resolve) => {
  //     this.send(
  //       header,
  //       // eslint-disable-next-line no-underscore-dangle
  //       SteamUser._encodeProto(CStore_GetLocalizedNameForTags_Request, data),
  //       (body: any) => {
  //         console.log(body);
  //         resolve(body as ChangeHistory);
  //         // resolve(
  //         //   // eslint-disable-next-line no-underscore-dangle
  //         //   SteamUser._decodeProto(CStore_GetLocalizedNameForTags_Response, body)
  //                  as ChangeHistory,
  //         // );
  //       },
  //     );
  //   });
  // }

  getChangeHistory(fileId: string, count = 1): Promise<ChangeHistory> {
    return this.request('CPublishedFile_GetChangeHistory', {
      publishedfileid: fileId,
      total_only: false,
      startindex: 0,
      count,
    });
  }

  queryFiles(appId: number, cursor = '*'): Promise<QueryFilesResponse> {
    return this.request('CPublishedFile_QueryFiles', {
      appid: appId,
      cursor,
      numperpage: 25,
      query_type: SteamUser.EPublishedFileQueryType.RankedByPublicationDate,
      return_details: true,
    });
  }

  private request<T>(
    protoSchema: string,
    data: object,
  ) {
    const header = {
      msg: EMsg.ServiceMethodCallFromClient,
      proto: {
        target_job_name: `${protoSchema.substring(1).replace('_', '.')}#1`,
      },
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, 10000);

      // Unable to augment SteamUser, but this method definitely exists (03-messages.js)
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      this._send(
        header,
        // eslint-disable-next-line no-underscore-dangle
        SteamUser._encodeProto(Schema[`${protoSchema}_Request`], data),
        (body: ByteBuffer) => {
          clearTimeout(timer);
          resolve(
            // eslint-disable-next-line no-underscore-dangle
            SteamUser._decodeProto(Schema[`${protoSchema}_Response`], body) as any,
          );
        },
      );
    });
  }
}
