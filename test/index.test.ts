/// <reference types="@remix-run/node/globals" />
import { createSessionStorage } from "@remix-run/node";
import { Redis } from "@upstash/redis";
import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import { createUpstashSessionStorage } from "../src/index";

describe(createUpstashSessionStorage.name, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("Should throw without redis or createSessionFunction", async () => {
    try {
      createUpstashSessionStorage({
        cookie: { name: "session", secrets: ["s3cr3ts"], path: "/" },
        //@ts-expect-error intentional
        redis: undefined,
        //@ts-expect-error intentional
        createSessionStorage: undefined,
      });
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).toEqual(
        "Need to provide an upstash redis client instance"
      );
    }
    try {
      createUpstashSessionStorage({
        cookie: { name: "session", secrets: ["s3cr3ts"], path: "/" },
        redis: new Redis({ url: "", token: "" }),
        //@ts-expect-error intentional
        createSessionStorage: undefined,
      });
    } catch (e) {
      assert(e instanceof Error);
      expect(e.message).toEqual(
        "Need to provide a remix createSessionStorage function"
      );
    }
  });

  test("Should work without initial cookie", async () => {
    const redis = new Redis({ url: "", token: "" });
    const sessionStorage = createUpstashSessionStorage({
      redis,
      createSessionStorage,
    });
    const session = await sessionStorage.getSession();
    expect(session.id).toEqual("");

    expect(redis.set).not.toHaveBeenCalled();

    session.set("val", "something");
    const header = await sessionStorage.commitSession(session);
    expect(redis.set).toHaveBeenCalledOnce();
    const newSession = await sessionStorage.getSession(header);
    expect(newSession.id).not.toBeUndefined();
    expect(newSession.id).not.toEqual("");
    expect(newSession.get("val")).toEqual("something");
  });

  test("Should set and retrieve the session", async () => {
    const redis = new Redis({ url: "", token: "" });
    const sessionStorage = createUpstashSessionStorage({
      cookie: { name: "session", secrets: ["s3cr3ts"], path: "/" },
      redis,
      createSessionStorage,
    });
    const session = await sessionStorage.getSession();
    expect(session.id).toEqual("");

    expect(redis.set).not.toHaveBeenCalled();

    const url = new URL(`/`, "http://localhost:3000");
    session.set("val", "something");

    const request = new Request(url, {
      method: "POST",
      headers: {
        Cookie: await sessionStorage.commitSession(session),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(redis.set).toHaveBeenCalledOnce();
    const newSession = await sessionStorage.getSession(
      request.headers.get("cookie")
    );
    expect(newSession.id).not.toBeUndefined();
    expect(newSession.id).not.toEqual("");
    expect(newSession.get("val")).toEqual("something");
  });

  test("Should use provided key prefix", async () => {
    const redis = new Redis({ url: "", token: "" });
    const keyPrefix = "prefix";
    const sessionStorage = createUpstashSessionStorage({
      cookie: { name: "session", secrets: ["s3cr3ts"], path: "/" },
      redis,
      keyPrefix,
      createSessionStorage,
    });
    const session = await sessionStorage.getSession();
    expect(session.id).toEqual("");

    session.set("val", "another");

    const url = new URL(`/`, "http://localhost:3000");

    const request = new Request(url, {
      method: "POST",
      headers: {
        Cookie: await sessionStorage.commitSession(session),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(redis.set).toHaveBeenCalledOnce();
    const newSession = await sessionStorage.getSession(
      request.headers.get("cookie")
    );
    expect(newSession.id).not.toBeUndefined();
    expect(newSession.get("val")).toEqual("another");

    expect(redis.get(`${keyPrefix}${newSession.id}`)).toMatchObject({
      val: "another",
    });
  });

  test("Should set and delete the session", async () => {
    const redis = new Redis({ url: "", token: "" });
    const sessionStorage = createUpstashSessionStorage({
      cookie: { name: "session", secrets: ["s3cr3ts"], path: "/" },
      redis,
      createSessionStorage,
    });
    const session = await sessionStorage.getSession();
    expect(session.id).toEqual("");

    expect(redis.set).not.toHaveBeenCalled();

    const url = new URL(`/`, "http://localhost:3000");
    session.set("val", "something");

    const request = new Request(url, {
      method: "POST",
      headers: {
        Cookie: await sessionStorage.destroySession(session),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(redis.set).not.toHaveBeenCalledOnce();
    expect(redis.del).toHaveBeenCalledOnce();
    const newSession = await sessionStorage.getSession(
      request.headers.get("cookie")
    );
    expect(newSession.id).not.toBeUndefined();
    expect(newSession.id).toEqual("");

    expect(newSession.get("val")).not.toBeDefined();
  });

  test("Should ignore empty set call by default", async () => {
    const redis = new Redis({ url: "", token: "" });
    const sessionStorage = createUpstashSessionStorage({
      cookie: { name: "session", secrets: ["s3cr3ts"], path: "/" },
      redis,
      createSessionStorage,
    });
    const session = await sessionStorage.getSession();
    expect(session.id).toEqual("");

    const url = new URL(`/`, "http://localhost:3000");
    const request = new Request(url, {
      method: "POST",
      headers: {
        Cookie: await sessionStorage.commitSession(session),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(redis.set).not.toHaveBeenCalledOnce();
    const newSession = await sessionStorage.getSession(
      request.headers.get("cookie")
    );
    expect(newSession.id).not.toBeUndefined();
    expect(newSession.id).not.toEqual("");
    expect(newSession.data).toMatchObject({});

    newSession.set("val", "somethingelse");

    const request2 = new Request(url, {
      method: "POST",
      headers: {
        Cookie: await sessionStorage.commitSession(newSession),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(redis.set).toHaveBeenCalledOnce();
    const newestSession = await sessionStorage.getSession(
      request2.headers.get("cookie")
    );
    expect(newestSession.get("val")).toEqual("somethingelse");
  });

  test("Should not ignore empty set call if `saveUninitialized` option is set", async () => {
    const redis = new Redis({ url: "", token: "" });
    const sessionStorage = createUpstashSessionStorage({
      cookie: { name: "session", secrets: ["s3cr3ts"], path: "/" },
      redis,
      createSessionStorage,
      saveUninitialized: true,
    });
    const session = await sessionStorage.getSession();
    expect(session.id).toEqual("");

    const url = new URL(`/`, "http://localhost:3000");
    const request = new Request(url, {
      method: "POST",
      headers: {
        Cookie: await sessionStorage.commitSession(session),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(redis.set).toHaveBeenCalledOnce();
    const newSession = await sessionStorage.getSession(
      request.headers.get("cookie")
    );
    expect(newSession.get("val")).toBeUndefined();
    expect(newSession.id).not.toBeUndefined();
    expect(newSession.id).not.toEqual("");
  });
});
