FROM node:lts-alpine as build

ARG package_dir
ARG package_name

LABEL name "SteamWatch $package_name Builder"

WORKDIR /opt/build

COPY package*.json tsconfig*.json .eslintrc ./
COPY packages/${package_dir}/package.json packages/${package_dir}/tsconfig.json ./packages/${package_dir}/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

RUN npm install

COPY packages/${package_dir}/src ./packages/${package_dir}/src
COPY packages/shared/src ./packages/shared/src

RUN npm run build \
  && npm prune --production \
  && rm -rf packages/**/src \
  && mkdir -p packages/${package_dir}/data

FROM node:lts-alpine

ARG package_dir
ARG package_name
ENV TARGET "packages/${package_dir}/dist/index.js"
ENV SERVER_PORT 8080

LABEL name "SteamWatch $package_name"
LABEL version "Latest"

WORKDIR /srv/steamwatch

COPY --from=build /opt/build ./

EXPOSE $SERVER_PORT

VOLUME /srv/steamwatch/packages/${package_dir}/data

CMD ["sh", "-c", "node $TARGET"]
