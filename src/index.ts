import { random } from "@lukeed/csprng";
import type {
  CreateSessionStorageFunction,
  SessionData,
  SessionIdStorageStrategy,
  SessionStorage,
} from "@remix-run/server-runtime";
import type { Redis } from "@upstash/redis";

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

/**
 * Creates a SessionStorage that stores session data on in Upstash redis.
 * Uses key/value not hash because hash can't use TTL.
 * @see https://remix.run/docs/en/v1/api/remix#createsessionstorage
 */
export function createUpstashSessionStorage({
  cookie,
  redis,
  createSessionStorage,
  keyPrefix = "_session:",
  saveUninitialized = false,
}: UpstashSessionStorageOptions): SessionStorage {
  if (!redis) {
    throw new Error("Need to provide an upstash redis client instance");
  }
  if (!createSessionStorage) {
    throw new Error("Need to provide a remix createSessionStorage function");
  }
  const buildKey = (id: string) => `${keyPrefix}${id}`;

  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      const id = createId();

      if (Object.keys(data).length !== 0 || saveUninitialized) {
        await setData(redis, { key: buildKey(id), data, expires });
      }

      return id;
    },
    async readData(id) {
      if (typeof id !== "string") {
        return null;
      }
      return redis.get<SessionData>(buildKey(id));
    },
    async updateData(id, data, expires) {
      if (typeof id !== "string") {
        return;
      }
      await setData(redis, { key: buildKey(id), data, expires });
    },
    async deleteData(id) {
      await redis.del(buildKey(id));
    },
  });
}

type SetDataArgs = {
  key: string;
  data: SessionData;
  expires?: Date;
};
async function setData(redis: Redis, { key, data, expires }: SetDataArgs) {
  const expInSeconds = expiresToSeconds(expires);
  return redis.set(
    key,
    JSON.stringify(data),
    expInSeconds ? { ex: expInSeconds } : {}
  );
}

function expiresToSeconds(expires?: Date) {
  if (expires) {
    const now = new Date();
    const expiresDate = new Date(expires);
    const secondsDelta = Math.ceil(
      (expiresDate.getTime() - now.getTime()) / 1000
    );
    return secondsDelta < 0 ? 0 : secondsDelta;
  }
  return null;
}

function createId() {
  const randomBytes = random(8);
  const id = randomBytes.toString("hex");
  return id;
}
