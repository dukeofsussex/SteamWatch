/* eslint-disable no-underscore-dangle */
const { parse } = require('vdf');
const Steam = require('steam');

const { EMsg } = Steam;
const schema = Steam.Internal;

export interface SteamCallback {
  (result: object): void;
}

export default class SteamPICS {
  client: any;

  constructor(steamClient: any) {
    this.client = steamClient;
  }

  getProductInfo(apps: object[], callback: SteamCallback) {
    this.client._send({
      msg: EMsg.ClientPICSProductInfoRequest,
      proto: {},
    }, new schema.CMsgClientPICSProductInfoRequest({
      apps,
    }).toBuffer(), (_: any, body: any) => {
      const result = Steam._processProto(schema.CMsgClientPICSProductInfoResponse.decode(body));

      for (let i = 0; i < result.apps.length; i += 1) {
        const app = result.apps[i];
        app.details = parse(app.buffer.toString('utf8')).appinfo.common;
      }

      callback(result);
    });
  }
}
