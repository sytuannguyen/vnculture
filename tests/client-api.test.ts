// Phone-side API helper: profile storage, transparent re-join, friendly errors.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, friendlyError, loadProfile, post, saveProfile, setPid, setRejoinHandler } from "../src/lib/api";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("profile storage", () => {
  it("round-trips and survives corrupt or blocked storage", () => {
    expect(loadProfile()).toBeNull();
    saveProfile({ id: "a", name: "Emma", avatar: "🐨", role: "visitor" });
    expect(loadProfile()?.name).toBe("Emma");
    mem.set("culture.profile.v1", "{oops");
    expect(loadProfile()).toBeNull();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(loadProfile()).toBeNull();
    expect(() => saveProfile({ id: "a", name: "x", avatar: "🐨", role: "visitor" })).not.toThrow();
  });
});

describe("post", () => {
  it("sends the participant id with every request", async () => {
    const f = vi.fn(async () => reply(200, { ok: true }));
    vi.stubGlobal("fetch", f);
    setPid("kid-1");
    expect(await post("/api/tone", { correct: true })).toEqual({ ok: true });
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ pid: "kid-1", correct: true });
  });
  it("re-joins once on 409 (server was reset) and retries", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(409, { error: "rejoin" })).mockResolvedValueOnce(reply(200, { ok: 1 }));
    vi.stubGlobal("fetch", f);
    const rejoin = vi.fn(async () => undefined);
    setRejoinHandler(rejoin);
    expect(await post("/api/tone")).toEqual({ ok: 1 });
    expect(rejoin).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("does not loop forever when re-joining doesn't help", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(409, { error: "rejoin" })));
    setRejoinHandler(async () => undefined);
    await expect(post("/api/tone")).rejects.toBeInstanceOf(ApiError);
  });
  it("throws ApiError with status and body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(429, { error: "slow_down", message: "Breathe!" })));
    const e = await post("/api/ai/guide").catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(429);
    expect(e.message).toBe("Breathe!");
  });
});

describe("friendlyError", () => {
  it("shows server messages for rate limits and no-speech, generic text otherwise", () => {
    expect(friendlyError(new ApiError(429, { message: "Slow down 😄" }))).toBe("Slow down 😄");
    expect(friendlyError(new ApiError(422, { message: "Speak up" }))).toBe("Speak up");
    expect(friendlyError(new ApiError(500, { message: "stack trace" }))).toMatch(/hiccuped/);
    expect(friendlyError(new DOMException("x", "AbortError"))).toMatch(/too long/);
  });
});
