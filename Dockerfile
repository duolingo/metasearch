FROM docker.io/library/node:22.19.0-trixie

ENV DEBIAN_FRONTEND="noninteractive"

RUN apt-get update \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /code

COPY . .

RUN make build

ENV NODE_ENV production

ENTRYPOINT ["node", "src/index.js"]
