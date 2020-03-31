/* eslint-disable no-underscore-dangle */
const Steam = require('steam');
const SteamID = require('steam/lib/steamID');

export default class SteamUser extends Steam.SteamUser {
  logOnAnon() {
    const logOnDetails = {
      protocol_version: 65575,
    };

    // Construct anonymous SteamID
    this._client.steamID = new SteamID({
      accountUniverse: Steam.EUniverse.Public,
      accountType: Steam.EAccountType.AnonUser,
    }).toString();

    this._client.send({
      msg: Steam.EMsg.ClientLogon,
      proto: {},
    }, new Steam.Internal.CMsgClientLogon(logOnDetails).toBuffer());
  }
}
