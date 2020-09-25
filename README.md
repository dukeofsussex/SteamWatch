<p align="center">
  <a href="https://steam.watch">
    <img src="https://steam.watch/img/logo.svg" alt="Logo" height="192">
  </a>
  <h3 align="center">Steam Watch</h3>
  <p align="center">
    A Discord bot for keeping track of Steam apps.
    <br />
    <br />
    <a href="https://discord.gg/Sch9ak3"><img src="https://discord.com/api/guilds/196820438398140417/embed.png" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/discord.js"><img src="https://img.shields.io/github/package-json/dependency-version/dukeofsussex/SteamWatch/discord.js" alt="Discord.js version"/></a>
    <a href="https://david-dm.org/dukeofsussex/SteamWatch"><img src="https://img.shields.io/david/dukeofsussex/SteamWatch" alt="Dependencies"/></a>
    <a href="https://github.com/dukeofsussex/SteamWatch/blob/master/LICENSE"><img src="https://img.shields.io/github/license/dukeofsussex/SteamWatch" alt="License"/></a>
    <a href="/"><img src="https://img.shields.io/github/package-json/v/dukeofsussex/SteamWatch" alt="Version"/></a>
  </p>
</p>

## Getting Started

To get a local copy up and running follow these simple steps:

### Prerequisites

* [Discord bot token](https://discord.com/developers/applications)
* [NodeJS](https://nodejs.org/en/)
* [MariaDB](https://mariadb.org/) (or [MySQL](https://www.mysql.com/))

### Installation

1. Clone the repo
```sh
git clone https://github.com/dukeofsussex/SteamWatch.git
```
2. Install NPM packages
```sh
npm install
```
3. Configure the bot by copying `.env.example` to `.env` and setting the provided parameters
4. (Optional) Build the bot for production
```sh
npm run build
```
5. Run the bot
```sh
# development
npm run dev

# production
node .
```

## Contributing

Any contributions made are welcome and greatly appreciated.

1. Fork the project
2. Create your feature branch (`git checkout -b feature`)
3. Code it
4. Commit your changes (`git commit -m 'Add something awesome'`)
5. Push to the branch (`git push origin feature`)
6. Open a Pull Request

## License

This project is licensed under the GNU GPL License. See the [LICENSE](LICENSE) file for details.
