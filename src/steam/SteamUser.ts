/* eslint-disable no-underscore-dangle */
const Steam = require('steam');
const SteamID = require('steam/lib/steamID');

export default class SteamUser extends Steam.SteamUser {
  logOnAnon() {
    const logOnDetails = {};

    // construct temporary SteamID
    this._client.steamID = new SteamID({
      accountUniverse: Steam.EUniverse.Public,
      accountType: Steam.EAccountType.AnonUser,
    }).toString();

    // @ts-ignore Missing typings
    logOnDetails.protocol_version = 65575;
    this._client.send({
      msg: Steam.EMsg.ClientLogon,
      proto: {},
    }, new Steam.Internal.CMsgClientLogon(logOnDetails).toBuffer());
  }
}
