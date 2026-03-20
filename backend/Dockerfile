FROM debian:bookworm-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        xz-utils \
        libpcre2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/zig \
    && curl -fsSL https://ziglang.org/download/0.14.1/zig-x86_64-linux-0.14.1.tar.xz \
      | tar -xJ -C /opt/zig

ENV PATH="/opt/zig/zig-x86_64-linux-0.14.1:${PATH}"

WORKDIR /app
COPY . .

RUN zig build -Doptimize=ReleaseSafe

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libpcre2-8-0 \
        imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/zig-out/bin/maryannstories-backend /app/maryannstories-backend

ENV PORT=4000
EXPOSE 4000

CMD ["./maryannstories-backend"]
