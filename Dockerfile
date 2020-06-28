FROM node:14.4.0

WORKDIR /code

COPY . .

RUN make build

ENTRYPOINT ["make", "serve"]
