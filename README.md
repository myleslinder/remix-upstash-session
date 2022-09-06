# Remix Upstash Session

A super simple library to use uptash redis for remix sessions.

It's pretty much what exists in the [/examples directory](https://github.com/remix-run/remix/tree/main/examples/redis-upstash-session) and as outlined in [this upstash blog post](https://upstash.com/blog/redis-session-remix).

## Differences

Instead of using the upstash HTTP API directly it uses a provided [`@upstash/redis` client](https://docs.upstash.com/redis/sdks/javascriptsdk/getstarted)

You can use this everywhere remix works because it takes in a [`createSessionStorage` function](https://remix.run/docs/en/v1/api/remix#createsessionstorage) which you can import yourself based on your server runtime (e.g. from @remix-run/node or cloudflare or deno).

It also uses [`@lukeed/csprng`](https://github.com/lukeed/csprng) to generate random bytes for use as ids so it will use the cryptographically secure generator for your runtime.

## License

MIT
