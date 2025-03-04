# Tutorial: Self-Hosting SteamWatch with Docker Compose
by @skolmeister
## Table of contents
- [Tutorial: Self-Hosting SteamWatch with Docker Compose](#tutorial-self-hosting-steamwatch-with-docker-compose)
  - [Table of contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Docker Compose](#docker-compose)
  - [Setting up all components](#setting-up-all-components)
    - [Prerequisites](#prerequisites)
    - [MariaDB](#mariadb)
      - [Adminer](#adminer)
    - [SteamWatch](#steamwatch)
      - [Processes](#processes)
      - [Interactions](#interactions)
    - [ngrok](#ngrok)
  - [Putting it all together](#putting-it-all-together)
    - [Complete docker-compose.yml](#complete-docker-composeyml)
  - [Common Problems](#common-problems)

## Introduction

To get the full power of SteamWatch in just a few minutes you can use a complete Docker Compose Stack with all the needed software:

* MariaDB with adminer as frontend
* node.js with all needed npm packages
* ngrok reverse proxy for the interactions endpoint on Discord's side

The only other thing to do before starting is setting up a Discord Bot via the [Discord Developer Portal](https://discord.com/developers).
This tutorial assumes that you have at least some experience with Discord Bots and will not dive deeper into this part.

## Docker Compose 

First you need Docker with Docker Compose. The huge benefit of Docker is that it runs on nearly every system and can be easily installed.
Docker Compose is a plugin that lets you start containers from `docker-compose.yml` files which are quite human readable and portable.

Visit the [Docker Website](https://docs.docker.com/engine/install/) to get the installation instructions for your system. 
Afterwards, you can install the [Docker Compose Plugin](https://docs.docker.com/compose/install/) and make yourself familiar with Docker compose with their [Docs](https://docs.docker.com/compose/intro/compose-application-model/).

## Setting up all components

### Prerequisites

To get everything up and running, you'll first need a project directory and a fresh copy of this repository.
For the rest of the tutorial I will use UNIX-Style Code, but everything can be done on a Windows machine, too.

```sh
# Create a directory
mkdir /home/USER/projects/steamwatch
# Clone the git repo
git clone https://github.com/dukeofsussex/SteamWatch.git /home/USER/projects/steamwatch
# Move into the directory
cd /home/USER/projects/steamwatch

```

### MariaDB

The next part will be setting up our database with MariaDB.
For this purpose, we need a new subdirectory in our projects home for storing the data and config for the database.

```sh
# Create the directory structure
mkdir mariadb
mkdir mariadb/mariadb_data
mkdir mariadb/mariadb_init
```

The `mariadb_init` directory will hold a configuration file like `init.sql`. Create the file either with `touch` or your preferred text editor.

```sh
vim mariadb/mariadb_init/init.sql

```
In the config file you have to tell MariaDB to create a database named `steamwatch` and grant the user `steamwatch` all rights for this database.

```sql
CREATE steamwatch;
USE steamwatch;

GRANT ALL PRIVILEGES ON 'steamwatch'.* TO 'steamwatch';

```

Now we can start putting our first service for the `docker-compose.yml` together:

```yaml
---
services:
  # MariaDB is needed for SteamWatch to save all your data
  steamwatch_mariadb:
    image: mariadb:10.5
    restart: always
    environment:
      # You'll set the credentials in your mariadb/init.sql file
      MARIADB_ROOT_PASSWORD: SECRET_PW
      MARIADB_USER: steamwatch
      MARIADB_PASSWORD: SECRET_PW
      MARIADB_DATABASE: steamwatch
    volumes: 
    # Volume to store the data
    - ./mariadb/mariadb_data:/var/lib/mysql
    # Volume to store the configuration
    - ./mariadb/mariadb_init:/docker-entrypoint-initdb.d
    ports:
      - 3306:3306
```

You pass the desired database credentials via the `environment` parameters.

#### Adminer

You could just fire up the container and query the database directly via cli, but it's always nice to have a lightweight UI.
This is what [Adminer](https://www.adminer.org/) does.

Add the service to your `docker-compose.yml` with the following lines:

```yaml
# Adminer is a very lightweight php database interface (visit localhost:28082 or your desired port)
  steamwatch_adminer:
    image: adminer
    restart: unless-stopped
    ports:
      - 28082:8080
```
Save the `docker-compose.yml` file and fire it up with `docker compose up -d`. The -d flag means it runs in the background (detached), otherwise it would block your console window.

Now you should be able to visit `localhost:28082` and be greeted by Adminer.

Logging in with the specified Credentials should show you an empty database. Make sure you use the MariaDB Container name for the `Server` entry (`steamwatch_mariadb` in this example).

### SteamWatch 

#### Processes

After setting up the database it's now time to get the SteamWatch services up and running. We start with the processes part.

First you'll need to create a docker image yourself, because the SteamWatch images are not hosted on [DockerHub](https://hub.docker.com/).
You might have seen the file named [Dockerfile](Dockerfile) in the repository, and exactly is what we need for creating the images.

In the file we can see that at the top two arguments `package_dir` and `package-name` are defined. We will need to provide this arguments to Docker when building the image. This handles which part (Interactions or Processes) is used.

Now build the image with
```sh
docker build -t steamwatch_interactions  --build-arg package_dir=interactions --build-arg package_name=interactions .
```
During the build, you can see what docker is doing and installing.
After completion, we are ready for the `docker-compose.yml` part.

We set our now created image as the containers `image` and give a name to the container.
We can also mount some drives from inside the container on our machine, but I currently don't see any uses here.

The most important part is filling out the environment variables. You can see the full list in [.env.example](.env.example).
Use your MariaDB credentials so the application can access the database and set your Discord Application information (App ID, Bot Token, App Public Key).

I store my secret credentials in my `~/.zshrc` file via e.g. `export DISCORD_PUBLICKEY="MYKEY"` so I don't need to provide the secrets publicly in the file.

``` yaml
steamwatch_processes:
    image: steamwatch_processes
    container_name: steamwatch_processes
    # I'm not sure if the volume here is really needed, all data is stored in the db anyways
    volumes: 
      - /docker/steamwatch/processes:/packages
    restart: unless-stopped 
    # Set your environment variables here (not in .env File)
    environment:
      # development or production
      - NODE_ENV=development
      # the MariaDB database credentials
      - DB_DATABASE=steamwatch
      - DB_HOST=steamwatch_mariadb
      - DB_PORT=3306
      - DB_USER=steamwatch
      - DB_PASSWORD=SECRET_PW
      # Set your Guild ID where you want to support bot users 
      - DEV_GUILD_ID=YOUR_GUILD_ID
      - DISCORD_INVITE=YOUR_INVITE_LINK
      # Set the app / bot credentials from your dev.discord.com page
      - DISCORD_APP_ID=YOUR_APP_ID
      # I store my keys and tokens in .zshrc / .bashrc file 
      - DISCORD_APP_PUBLIC_KEY=${AI_ROLF_PUBLIC_KEY}
      - DISCORD_BOT_TOKEN=${AI_ROLF_BOT_TOKEN}
      - LOG_LEVEL=debug
      # define the address host:port INSIDE the container
      # It is probably only needed for interactions, not processes
      # Use 0.0.0.0 and a port of your choice, the port will be needed to be forwarded to outside docker
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=28080
      # Set your desired values (more watchers and higher frequency mean higher workload on your machine) 
      - SETTINGS_MAX_MENTIONS_PER_WATCHER=999
      - SETTINGS_MAX_WATCHERS_PER_GUILD=999
      - SETTINGS_WATCHER_RUN_FREQUENCY=10
```

#### Interactions

The interactions part works just like processes.

First build the image with 
```sh
docker build -t steamwatch_processes  --build-arg package_dir=processes --build-arg package_name=processes .
```
And then set up the container with a very similar `yaml` structure. 
Just change the `image`, `container-name`, `volumes` parameters and add the `ports` variable, because you will need the application running on the defined port be accesible from the outside.

```yaml
  steamwatch_interactions:
    image: steamwatch_interactions
    container_name: steamwatch_interactions
    volumes: 
      - /docker/steamwatch/interactions:/interactions
    ports: 
      # you need to forward the port you opened inside the container so it's available on your localhost
      - 28081:28081
    restart: unless-stopped
    environment:
    # You can keep the same environment settings as in processes
      - NODE_ENV=development
      - DB_DATABASE=steamwatch
      - DB_HOST=steamwatch_mariadb
      - DB_PORT=3306
      - DB_USER=steamwatch
      - DB_PASSWORD=SECRET_PW
      - DEV_GUILD_ID=YOUR_GUILD_ID
      - DISCORD_INVITE=https://discord.com/oauth2/authorize?client_id=1345707232733691924
      - DISCORD_APP_ID=YOUR_APP_ID
      - DISCORD_APP_PUBLIC_KEY=${AI_ROLF_PUBLIC_KEY}
      - DISCORD_BOT_TOKEN=${AI_ROLF_BOT_TOKEN}
      - LOG_LEVEL=debug
      # define the address host:port INSIDE the container
      # It is probably only needed for interactions, not processes
      # Use 0.0.0.0 and a port of your choice, the port will be needed to be forwarded to outside docker
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=28081
      - SETTINGS_MAX_MENTIONS_PER_WATCHER=999
      - SETTINGS_MAX_WATCHERS_PER_GUILD=999
      - SETTINGS_WATCHER_RUN_FREQUENCY=10
```

Now we could run both applications with again `docker compose up -d`. To check if everything is running as it should you may check the logs coming from the containers. It's very easy if you already use a log aggregator like [dozzle](https://dozzle.dev/), otherwise run `docker compose logs CONTAINER_NAME`.

### ngrok

The last part is now implementing [ngrok](https://ngrok.com/) to provide an endpoint for the [Discord Interactions API](https://discordpy.readthedocs.io/en/stable/interactions/api.html).

First you need to visit [ngrok](https://ngrok.com/) and sign up for a free account. Then access your personal `AUTHTOKEN`, so the application can authenticate with ngrok and store it in your environment variables.

Set up the service as the following:

```yml
  # We use ngrok (https://ngrok.com/) as an endpoint for discord
  # You'll need to set up an account (free) with them
  steamwatch_ngrok:
    image: ngrok/ngrok:latest
    container_name: steamwatch_ngrok
    restart: unless-stopped
    command:
      # Tell ngrok to open a tunnel to your docker hosts port 28081
      - "http"
      - "http://host.docker.internal:28081"
    environment:
      # The authtoken obtained at ngrok.com
      - NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN}
    ports:
      # ngrok has a web-interface where you can check your tunnel status and get the endpoint URL
      - 4040:4040
    extra_hosts:
      # Define the host.docker.internal host, otherwise the mapping will fail
      - "host.docker.internal=host-gateway"
```
See the [ngrok Docker reference](https://ngrok.com/docs/using-ngrok-with/docker/) for further explanation. One point that is not mentioned there is that you need to add the `extra_hosts` at the end. Otherwise ngrok will always try to map to the internal docker network (`127.0.0.11`) instead of your localhost. 

You can visit `localhost:4040` now and hopefully see a functioning tunnel to your service. It's correctly configured if you see a `404 Not Found` in the first `GET /` request in the `Inspect` panel.
Copy the URL from the `Status` page, paste it to the variable `INTERACTIONS ENDPOINT URL` in your discord bot's `General Information` tab and append a `/interactions` at the end.

It should look something like `https://NUMBERS-XXX-XXX-XXX-XXX.ngrok-free.app/interactions`. Saving the changes should yield in a green `All your changes have been carefully recorded` banner. 

## Putting it all together

All services are set up and it's time to try them out.

### Complete docker-compose.yml

Your `docker-compose.yml` should look like this now:

```yml
---
services:
  # MariaDB is needed for SteamWatch to save all your data
  steamwatch_mariadb:
    image: mariadb:10.5
    restart: always
    environment:
      # You'll set the credentials in your mariadb/init.sql file
      MARIADB_ROOT_PASSWORD: SECRET_PW
      MARIADB_USER: steamwatch
      MARIADB_PASSWORD: SECRET_PW
      MARIADB_DATABASE: steamwatch
    volumes: 
    # Volume to store the data
    - ./mariadb/mariadb_data:/var/lib/mysql
    # Volume to store the configuration
    - ./mariadb/mariadb_init:/docker-entrypoint-initdb.d
    ports:
      - 3306:3306
  # Adminer is a very lightweight php database interface (visit localhost:28082 or your desired port)
  steamwatch_adminer:
    image: adminer
    restart: unless-stopped
    ports:
      - 28082:8080
  # The Processes side handles the configured tasks (like everything you tell the App to do via slash commands)
  steamwatch_processes:
    image: steamwatch_processes
    container_name: steamwatch_processes
    # I'm not sure if the volume here is really needed, all data is stored in the db anyways
    volumes: 
      - /docker/steamwatch/processes:/packages
    restart: unless-stopped 
    # Set your environment variables here (not in .env File)
    environment:
      # development or production
      - NODE_ENV=development
      # the MariaDB database credentials
      - DB_DATABASE=steamwatch
      - DB_HOST=steamwatch_mariadb
      - DB_PORT=3306
      - DB_USER=steamwatch
      - DB_PASSWORD=SECRET_PW
      # Set your Guild ID where you want to support bot users 
      - DEV_GUILD_ID=YOUR_GUILD_ID
      - DISCORD_INVITE=YOUR_INVITE
      # Set the app / bot credentials from your dev.discord.com page
      - DISCORD_APP_ID=YOUR_APP_ID
      # I store my keys and tokens in .zshrc / .bashrc file 
      - DISCORD_APP_PUBLIC_KEY=${AI_ROLF_PUBLIC_KEY}
      - DISCORD_BOT_TOKEN=${AI_ROLF_BOT_TOKEN}
      - LOG_LEVEL=debug
      # define the address host:port INSIDE the container
      # It is probably only needed for interactions, not processes
      # Use 0.0.0.0 and a port of your choice, the port will be needed to be forwarded to outside docker
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=28080
      # Set your desired values (more watchers and higher frequency mean higher workload on your machine) 
      - SETTINGS_MAX_MENTIONS_PER_WATCHER=999
      - SETTINGS_MAX_WATCHERS_PER_GUILD=999
      - SETTINGS_WATCHER_RUN_FREQUENCY=10
  # Interactions handles the interactive part within discord (slash commands)
  steamwatch_interactions:
    image: steamwatch_interactions
    container_name: steamwatch_interactions
    volumes: 
      - /docker/steamwatch/interactions:/interactions
    ports: 
      # you need to forward the port you opened inside the container so it's available on your localhost
      - 28081:28081
    restart: unless-stopped
    environment:
    # You can keep the same environment settings as in processes
      - NODE_ENV=development
      - DB_DATABASE=steamwatch
      - DB_HOST=steamwatch_mariadb
      - DB_PORT=3306
      - DB_USER=steamwatch
      - DB_PASSWORD=SECRET_PW
      - DEV_GUILD_ID=YOUR_GUILD_ID
      - DISCORD_INVITE=YOUR_INVITE
      - DISCORD_APP_ID=YOUR_APP_ID
      - DISCORD_APP_PUBLIC_KEY=${AI_ROLF_PUBLIC_KEY}
      - DISCORD_BOT_TOKEN=${AI_ROLF_BOT_TOKEN}
      - LOG_LEVEL=debug
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=28081
      - SETTINGS_MAX_MENTIONS_PER_WATCHER=999
      - SETTINGS_MAX_WATCHERS_PER_GUILD=999
      - SETTINGS_WATCHER_RUN_FREQUENCY=10
  # We use ngrok (https://ngrok.com/) as an endpoint for discord
  # You'll need to set up an account (free) with them
  steamwatch_ngrok:
    image: ngrok/ngrok:latest
    container_name: steamwatch_ngrok
    restart: unless-stopped
    command:
      # Tell ngrok to open a tunnel to your docker hosts port 28081
      - "http"
      - "http://host.docker.internal:28081"
    environment:
      # The authtoken obtained at ngrok.com
      - NGROK_AUTHTOKEN=${NGROK_AUTHTOKEN}
    ports:
      # ngrok has a web-interface where you can check your tunnel status and get the endpoint URL
      - 4040:4040
    extra_hosts:
      # Define the host.docker.internal host, otherwise the mapping will fail
      - "host.docker.internal=host-gateway"
```

:rocket: Fire it up with `docker compose up -d` and check the logs if everything runs correct.

:tada: You can add the bot to your discord now and try it out!

## Common Problems

* I can't access `localhost:port` and get `ERR_CONNECTION_REFUSED`
  * The networking seems to be incorrect
  * Try to login to your container with shell `docker exec -it steamwatch_interactions sh`
  * Inspect the output of `netstat -l`, you should see your `SERVER_HOST:SERVER_PORT`
         
    ```sh
    /srv/steamwatch # netstat -l
    Active Internet connections (only servers)
    Proto Recv-Q Send-Q Local Address           Foreign Address         State       
    tcp        0      0 127.0.0.11:39643        0.0.0.0:*               LISTEN      
    tcp        0      0 0.0.0.0:28081           0.0.0.0:*               LISTEN     
    ```
  * Check if the port corresponds to the port specified in your yaml's `port` variable
* Discord can't verify the endpoint URL
  * Have a look at `localhost:28082` (or wherever your ngrok is located) and search for errors
  * Check if you have appended the ngrok-URL with `/interactions`
  * Check if the application serves the `404 Not Found` at `localhost:port` (see first bullet point)
  * Check the config of the `ngrok` service within `docker-compose.yml` if it corresponds to [the sample config](#ngrok)