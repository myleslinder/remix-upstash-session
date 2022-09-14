import { installGlobals } from "@remix-run/node";
import type { Redis } from "@upstash/redis";
import { vi } from "vitest";

installGlobals();

vi.mock("@upstash/redis", () => {
	const storage: Record<string, string> = {};
	const listStorage: Record<string, string[]> = {};
	const expiryMap: Record<string, number> = {};

	return {
		Redis: class {
			set = vi.fn(
				(key: string, data: string, opts: Parameters<Redis["set"]>[2]) => {
					storage[key] = data;

					//@ts-expect-error intentiona
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					expiryMap[key] = opts?.ex ?? -1;

					return data;
				},
			);
			get = vi.fn((key: string) => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return JSON.parse(storage[key] ?? "{}");
			});
			del = vi.fn((key: string) => {
				delete storage[key];
			});
			ttl = vi.fn((key: string) => {
				return expiryMap[key] ?? -2;
			});
			lrem = vi.fn((key: string, _: number, value: string) => {
				const vals = (listStorage[key] ?? []).filter((v) => v !== value);
				listStorage[key] = vals;
			});
			lpush = vi.fn((key: string, value: string) => {
				listStorage[key] = [...(listStorage[key] ?? []), value];
			});
			lrange = vi.fn((key: string) => listStorage[key]);
		},
	};
});
