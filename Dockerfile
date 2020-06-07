FROM node:12.13.1

WORKDIR /code

COPY . .

RUN make build

VOLUME ["/data"]

EXPOSE 3000

ENTRYPOINT ["make", "serve"]
