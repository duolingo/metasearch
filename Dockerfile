FROM node:12.13.1

WORKDIR /code

COPY . .

RUN make build

ENTRYPOINT ["make", "serve"]
