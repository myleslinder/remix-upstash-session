# Remix Upstash Session &nbsp;![](https://img.shields.io/npm/v/remix-upstash-session.svg)

A super simple library to use uptash redis for remix sessions.

It's pretty much what exists in the [/examples directory](https://github.com/remix-run/remix/tree/main/examples/redis-upstash-session) and as outlined in [this upstash blog post](https://upstash.com/blog/redis-session-remix).

## Differences

Instead of using the upstash HTTP API directly it uses a provided [`@upstash/redis` client](https://docs.upstash.com/redis/sdks/javascriptsdk/getstarted)

You can use this everywhere remix and @upstash/redis works because it takes in a [`createSessionStorage` function](https://remix.run/docs/en/v1/api/remix#createsessionstorage) which you can import yourself based on your server runtime (e.g. from @remix-run/node or cloudflare or deno).

It also uses [`@lukeed/csprng`](https://github.com/lukeed/csprng) to generate random bytes for use as ids so it will use the cryptographically secure generator for your runtime.

Offers a `saveUninitialized` option (defaults to false) that forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.

## Options

```ts
type UpstashSessionStorageOptions = {
  /**
   * An instance of the `@upstash/redis` client
   * @see https://docs.upstash.com/redis/sdks/javascriptsdk/getstarted
   */
  redis: Redis;

  /**
   * A remix `createSessionStorage` function, you pass this in
   * so that you can import it from the appropriate package,
   * e.g. from @remix-run/node or cloudflare or deno
   * @see https://remix.run/docs/en/v1/api/remix#createsessionstorage
   */
  createSessionStorage: CreateSessionStorageFunction;

  /**
   * The cookie used to store the session data on the client, or options used
   * to automatically create one. The expires from the cookie is what is provided
   * as the expires to the create and update data calls.
   * @see https://remix.run/docs/en/v1/api/remix#cookies
   */
  cookie?: SessionIdStorageStrategy["cookie"];

  /**
   * The prefix to attach to the key when stored in redis.
   * This should end with the key separator you normally use e.g. `:`
   *
   * Be careful with changing this value as
   * it will effectively invalidate all existing sessions
   *
   * @default _session:
   */
  keyPrefix?: string;
  /**
   * Forces a session that is "uninitialized" to be saved to the store.
   * A session is uninitialized when it is new but not modified.
   *
   * @default false
   */
  saveUninitialized?: boolean;
};
```

## License

MIT
