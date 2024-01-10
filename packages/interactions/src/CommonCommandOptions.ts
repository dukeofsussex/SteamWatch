import { CommandOptionType } from 'slash-create';
import {
  EPublishedFileInfoMatchingFileType as EPFIMFileType,
  WatcherType,
} from '@steamwatch/shared';

export default {
  App: {
    type: CommandOptionType.STRING,
    name: 'app',
    description: 'App id, name or url',
    autocomplete: true,
    required: true,
  },
  Curator: {
    type: CommandOptionType.STRING,
    name: 'curator',
    description: 'Curator id, name or url',
    required: true,
  },
  Currency: {
    type: CommandOptionType.INTEGER,
    name: 'currency',
    description: 'The currency to retrieve the price in',
    autocomplete: true,
  },
  Group: {
    type: CommandOptionType.STRING,
    name: 'group',
    description: 'Group name or url',
    required: true,
  },
  Profile: {
    type: CommandOptionType.STRING,
    name: 'profile',
    description: 'Custom url name or SteamID64',
    required: true,
  },
  UGC: {
    type: CommandOptionType.STRING,
    name: 'ugc',
    description: 'UGC id or url',
    required: true,
  },
  Watcher: {
    type: CommandOptionType.INTEGER,
    name: 'watcher_id',
    description: 'The watcher\'s id',
    autocomplete: true,
    required: true,
  },
  WorkshopFileType: {
    type: CommandOptionType.INTEGER,
    name: 'filetype',
    description: 'The type of workshop submissions to watch',
    required: true,
    choices: Object.keys(EPFIMFileType)
      .filter((ft) => [
        'Items',
        'Collections',
        'Art',
        'Videos',
        'Screenshots',
        'Guides',
        'Merch',
        'Microtransaction',
      ].includes(ft))
      .map((ft) => ({
        name: ft,
        value: EPFIMFileType[ft as keyof typeof EPFIMFileType],
      })),
  },
  WorkshopType: {
    type: CommandOptionType.STRING,
    name: 'type',
    description: 'The type of workshop changes to watch',
    required: true,
    choices: [{
      name: 'New submissions',
      value: WatcherType.WorkshopNew,
    }, {
      name: 'Updates to existing submissions',
      value: WatcherType.WorkshopUpdate,
    }],
  },
};
