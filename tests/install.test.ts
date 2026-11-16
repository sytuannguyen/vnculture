// "Install as an app": platform detection and the iOS profile hand-off.
import { describe, expect, it, vi } from "vitest";
import { adoptRestoreParam, decodeRestore, detectInstallKind, encodeRestore, isIOS } from "../src/lib/install";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0",
  ipadOS: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
  androidFacebook: "Mozilla/5.0 (Linux; Android 14; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US]",
  androidZalo: "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Zalo android/12100",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};
const kind = (ua: string, o: { standalone?: boolean; hasPrompt?: boolean; maxTouchPoints?: number } = {}) =>
  detectInstallKind({ ua, standalone: !!o.standalone, hasPrompt: !!o.hasPrompt, maxTouchPoints: o.maxTouchPoints ?? 0 });

describe("detectInstallKind", () => {
  it("hides the button once running as an installed app", () => {
    expect(kind(UA.iphoneSafari, { standalone: true })).toBe("installed");
    expect(kind(UA.androidChrome, { standalone: true, hasPrompt: true })).toBe("installed");
  });
  it("uses the native dialog whenever the browser offers one", () => {
    expect(kind(UA.androidChrome, { hasPrompt: true })).toBe("prompt");
    expect(kind(UA.windowsChrome, { hasPrompt: true })).toBe("prompt");
  });
  it("shows Share → Add to Home Screen steps on iPhone and iPad (Safari or Chrome)", () => {
    expect(kind(UA.iphoneSafari)).toBe("ios");
    expect(kind(UA.iphoneChrome)).toBe("ios");
    expect(kind(UA.ipadOS, { maxTouchPoints: 5 })).toBe("ios");
  });
  it("asks in-app browsers (Instagram, Facebook, Zalo) to open the real browser", () => {
    expect(kind(UA.iphoneInstagram)).toBe("inapp");
    expect(kind(UA.androidFacebook)).toBe("inapp");
    expect(kind(UA.androidZalo)).toBe("inapp");
  });
  it("falls back to menu instructions on Android without a prompt", () => {
    expect(kind(UA.androidChrome)).toBe("android");
  });
  it("offers nothing on a desktop without a prompt (e.g. the projector laptop)", () => {
    expect(kind(UA.windowsChrome)).toBe("none");
    expect(kind(UA.ipadOS, { maxTouchPoints: 0 })).toBe("none"); // a real Mac
  });
  it("isIOS spots iPadOS pretending to be a Mac", () => {
    expect(isIOS(UA.ipadOS, 5)).toBe(true);
    expect(isIOS(UA.ipadOS, 0)).toBe(false);
  });
});

describe("profile hand-off (iOS home-screen apps get fresh storage)", () => {
  const p = { id: "3f2a-9c1b-77", name: "Ngọc Ánh 🐉", avatar: "🐉", role: "local" as const };

  it("round-trips a profile with Vietnamese text and emoji, URL-safe", () => {
    const r = encodeRestore(p);
    expect(r).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeRestore(r)).toEqual(p);
  });
  it("rejects tampered or malformed values", () => {
    expect(decodeRestore(null)).toBeNull();
    expect(decodeRestore("not base64!")).toBeNull();
    expect(decodeRestore("x".repeat(500))).toBeNull();
    expect(decodeRestore(encodeRestore({ ...p, id: "<script>" }))).toBeNull();
  });
  it("adopts the profile on first launch and cleans the URL", () => {
    const save = vi.fn();
    expect(adoptRestoreParam(`https://x.vn/?r=${encodeRestore(p)}#top`, false, save)).toBe("/#top");
    expect(save).toHaveBeenCalledWith(p);
  });
  it("never overwrites an existing profile, and ignores URLs without ?r", () => {
    const save = vi.fn();
    expect(adoptRestoreParam(`https://x.vn/?r=${encodeRestore(p)}`, true, save)).toBe("/");
    expect(adoptRestoreParam("https://x.vn/", false, save)).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
