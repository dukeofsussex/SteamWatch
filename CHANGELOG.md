# Changelog

## [3.2.6]

### Added

- Slow down the message queue when Discord is having issues

### Changed

- Use provided error codes instead of maintaining an independent list

### Fixed

- Fix app's missing release date breaking commands relying on it in the returned embed

## [3.2.5]

### Fixed

- Fix mass data loss in case of Discord not returning guilds

## [3.2.4]

### Added

- Log command arguments

### Fixed

- Fix price command for not yet setup guilds
- Fix watcher webhook removal error

## [3.2.3]

### Fixed

- Fix not being able to remove watchers

## [3.2.2]

### Added

- Support watching Steam news by adding support for `config` apps

## [3.2.1]

### Fixed

- Fix guilds receiving multiple broadcasts

## [3.2.0]

### Added

- Add app workshop watching

### Changed

- Standardise embeds
- Changed command name for Steam browser protocol conversion command
- Rework some commands to interface with Steam instead of the local app cache
- Remove nested build output
- Remove emoji sanitisation as Discord fixed/changed slash command input
- Switch back to `INTEGER` parameters where possible

### Fixed

- Fix watcher removal command showing other guild's watchers
- Fix some commands not working with the `NUMBER` parameter type
- Strip query parameters from news thumbnails
- Fix watcher list exceeding the maximum message length
- Fix news embed titles exceeding the maximum title length
- Fix broadcasting feature always sending out the latest update news
- Fix guild currency not being used by default
- Fix Steam browser protocol conversion not recognising all workshop items

## [3.1.0]

### Added

- Add app workshop watching

### Changed

- Disable watcher autocomplete in DMs

### Fixed

- Fix watcher removal command showing other guild's watchers
- Fix some commands not working with the `NUMBER` parameter type
- Strip query parameters from news thumbnails
- Fix watcher list exceeding the maximum message length
- Fix news embed titles exceeding the maximum title length
- Fix broadcasting feature always sending out the latest update news
- Fix guild currency not being used by default

## [3.0.0]

### Added

- Add **U**ser-**G**enerated **C**ontent watching
- Add broadcasting feature to inform users of updates
- Add slash command parameter autocomplete for watcher ids
- Add slash command parameter autocomplete for apps
- Support announcement channels for watchers

### Changed

- Significantly improve logging
- No longer show old news posts when adding a new app

### Fixed

- Add protocol to fix some news thumbnails not working
- Fix store embeds not working for apps without a website
- Fix `@everyone` not working in watcher mentions

## [2.0.0]

### Changed

- Migrate to Slash Commands
- Migrate from [steam](https://github.com/seishun/node-steam) to [steam-user](https://github.com/DoctorMcKay/node-steam-user)
