import { installGlobals } from "@remix-run/node";
//import type { RedisConfigNodejs } from "@upstash/redis";
import { vi } from "vitest";

installGlobals();

vi.mock("@upstash/redis", () => {
  const storage: Record<string, string> = {};

  return {
    Redis: class {
      set = vi.fn((key: string, data: string, _expires?: Date) => {
        storage[key] = data;
        return data;
      });
      get = vi.fn((key: string) => {
        return JSON.parse(storage[key] ?? "{}");
      });
      del = vi.fn((key: string) => {
        delete storage[key];
      });
    },
  };
});
