import { installGlobals } from "@remix-run/node";
import type { Redis } from "@upstash/redis";
import { vi } from "vitest";

installGlobals();

vi.mock("@upstash/redis", () => {
  const storage: Record<string, string> = {};
  const expiryMap: Record<string, number> = {};

  return {
    Redis: class {
      set = vi.fn(
        (key: string, data: string, opts: Parameters<Redis["set"]>[2]) => {
          storage[key] = data;

          //@ts-expect-error intentiona
          expiryMap[key] = opts?.ex ?? -1;

          return data;
        }
      );
      get = vi.fn((key: string) => {
        return JSON.parse(storage[key] ?? "{}");
      });
      del = vi.fn((key: string) => {
        delete storage[key];
      });
      ttl = vi.fn((key: string) => {
        return expiryMap[key] ?? -2;
      });
    },
  };
});
