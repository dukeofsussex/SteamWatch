# Changelog

## [4.1.0]

### Added

- Log the response body for SteamAPI errors
- Support storing all guilds the bot is in instead of only the guilds that have been set up

### Changed

- Improve handling of component timeout edge cases
- Improve description of the command `query` parameter
- No longer store the `app_id` in the watcher table for UGC watchers as the UGC table already contains a reference to the app
- Changed `/info` command to properly include UGC watcher counts
- Prevent workshop watchers for apps that don't have workshops
- Improve watcher list generation

### Fixed

- Fix knex table typings not being available in other packages
- Fix UGCWatcher erroring on invalid responses
- Correctly reject expired interactions
- Fix watcher insertion
- Fix watcher maximum calculation (for new and existing guilds)
- Fix autocompletion for the `/store` command
- Fix some typings
- Fix guild worker not processing all guilds
- Clean up some queries

## [4.0.0] Docker & Patreon

- The entire project has now been converted to a monorepo and parts separated into packages for (easier) Docker support.
- Patreon subscriptions have been integrated into the project, with the core logic for this residing in a separate private repository. This feature can be ignored entirely when self-hosting.

### Added

- Add support for custom fastify host and port
- Expand Steam gateway functionality (add `CPublishedFile_GetChangeHistory` and `CPublishedFile_QueryFiles`)
- Include changelog in UGC watcher embeds
- Support forum channels for watchers
- Add `filesize` and `tags` to UGC embeds
- Add aliases to `/profile` command
- Add SteamDeck compatibility to store embeds
- Add Patreon database schema
- Add Patreon link to `/info` command embed
- Add `/subscription` and `/premium` commands
- Support custom webhook message sender name and avatar
- Add `active` column to `/watchers list` command embed
- Support dynamic watcher amount thresholds
  - Allow for more watchers via Patreon subscriptions
- Add external private Patreon package

### Changed

- No longer throw an error if no `.env` can be found
- Update repository support server link
- Rework logging format for Docker
- Update to Discord v10 endpoints
- Have message components time out sooner
- Move the Steam Gateway job to a single process
- Remove some redundant database columns
- Fetch more workshop submissions per cycle
- Increase embed markdown length
- Simplify `/watcher` commands
- Have `/search` and `/workshop` commands use the Steam gateway
- Hide some properties from UGC that cannot be subscribed to
- Only allow watchers for subscribable UGC
- Replace `/client` command with message context menu command
- Only show relevant information in store embeds
- Only run active watchers
- Update project dependencies

### Fixed

- Handle error caused by the bot not having a custom avatar
- Fix the Steam client link for news embeds
  - No longer shown for external news posts from third-party websites
  - Links to the correct event announcement if displayed
- Fix interface inconsistencies
- Fix `/news` and `/price` command descriptions (neither returns cached data anymore)

### Removed

- Remove the file logger (suboptimal in a Docker environment)
- Remove useless `SETTINGS_MAX_ARTICLE_LENGTH` and `SETTINGS_MAX_ARTICLE_NEWLINES` environment variables

## [3.3.3]

### Added

- Add small status endpoint to the interactions server

### Changed

- Improve command error responses

## [3.3.2]

### Fixed

- Fix process shutdown timeout

## [3.3.1]

### Changed

- Improve readability of permissions flags

## [3.3.0]

### Changed

- Simplify shutdown logic
- Block guild-only commands in DMs
- Update dependencies where possible (ignore ESM)

### Fixed

- Ensure bot has sufficient permissions (i.e. `MANAGE_WEBHOOKS`) to run specific commands

## [3.2.8]

### Fixed

- Fix exception when parsing invalid bbcode list tags
- Fix exception when shutting down the bot

## [3.2.7]

### Fixed

- Fix profile ids (i.e. very large invalid numbers) timing out app details requests
- Reduce severity of Discord's verification requests
- Fix slow entity monitoring

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
