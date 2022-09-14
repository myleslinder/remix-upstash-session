import { random } from "@lukeed/csprng";
import type {
	CreateSessionStorageFunction,
	SessionData,
	SessionIdStorageStrategy,
	SessionStorage,
} from "@remix-run/server-runtime";
import type { Redis } from "@upstash/redis";

type PickIdFn = (sessionData: SessionData) => string | undefined;

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
	 * If you provided a value for `getUserId` then this optoin
	 * sets the prefix of the keys used to store the session id lists.
	 * This should end with the key separator you normally use e.g. `:`
	 *
	 * Be careful with changing this value as
	 * it will eliminate your ability to retrieve previous session lists
	 *
	 * @default _device:
	 */
	deviceKeyPrefix?: string;
	/**
	 * Forces a session that is "uninitialized" to be saved to the store.
	 * A session is uninitialized when it is new but not modified.
	 *
	 * @default false
	 */
	saveUninitialized?: boolean;
};

type GetAllSessions = (userId: string) => Promise<SessionData[]>;
type WithAugmentation = SessionStorage & { getAllSessions: GetAllSessions };

/**
 * If you want to store all session ids
 * for a given user in a list to be able to
 * retrieve them all later provide this function which
 * will be called to pick the userId off the SessionData object.
 * Returning null or undefined will not cause the session
 * id to be saved in any list.
 */
//  pickUserId?: PickIdFn | NoOp;

/**
 * Creates a SessionStorage that stores session data on in Upstash redis.
 * Uses key/value not hash because hash can't use TTL.
 * @see https://remix.run/docs/en/v1/api/remix#createsessionstorage
 */
export function createUpstashSessionStorage(
	options: UpstashSessionStorageOptions,
): SessionStorage;
export function createUpstashSessionStorage(
	options: UpstashSessionStorageOptions,
	pickUserId: PickIdFn,
): SessionStorage & { getAllSessions: GetAllSessions };
export function createUpstashSessionStorage(
	{
		cookie,
		redis,
		createSessionStorage,
		keyPrefix = "_session:",
		deviceKeyPrefix = "_device:",
		saveUninitialized = false,
	}: UpstashSessionStorageOptions,
	pickUserId?: PickIdFn,
): SessionStorage | WithAugmentation {
	if (!redis) {
		throw new Error("Need to provide an upstash redis client instance");
	}
	if (!createSessionStorage) {
		throw new Error("Need to provide a remix createSessionStorage function");
	}
	const buildKey = (id: string) => `${keyPrefix}${id}`;
	const buildDeviceKey = (userId: string) => `${deviceKeyPrefix}${userId}`;

	const sessionStorage = createSessionStorage({
		cookie,
		async createData(data, expires) {
			const id = createId();

			if (Object.keys(data).length !== 0 || saveUninitialized) {
				await setData(redis, { key: buildKey(id), data, expires });
				const userId = pickUserId?.(data);
				if (userId) {
					await redis.lpush(buildDeviceKey(userId), id);
				}
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
			const data = await redis.get<SessionData>(buildKey(id));
			const userId = data ? pickUserId?.(data) : null;
			if (userId) {
				await redis.lrem(buildDeviceKey(userId), 0, id);
			}
			await redis.del(buildKey(id));
		},
	});

	if (pickUserId) {
		return {
			...sessionStorage,
			getAllSessions: async (userId: string) => {
				const sessionIds = await redis.lrange(buildDeviceKey(userId), 0, -1);
				const data = await Promise.all(
					sessionIds.map((id) => redis.get<SessionData>(buildKey(id))),
				);
				return data.filter(isSessionData);
			},
		};
	}
	return sessionStorage;
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
		expInSeconds ? { ex: expInSeconds } : {},
	);
}

function expiresToSeconds(expires?: Date) {
	if (expires) {
		const now = new Date();
		const expiresDate = new Date(expires);
		const secondsDelta = Math.ceil(
			(expiresDate.getTime() - now.getTime()) / 1000,
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

function isSessionData(obj: unknown): obj is SessionData {
	return obj !== null;
}
