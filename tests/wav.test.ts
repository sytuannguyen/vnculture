// WAV parsing: the gate in front of every pronunciation and voice upload.
import { describe, expect, it } from "vitest";
import { parseWav } from "../shared/vad";

function makeWav(opts: { sr?: number; channels?: number; bits?: number; samples?: number[]; extraChunk?: boolean } = {}): string {
  const { sr = 16000, channels = 1, bits = 16, samples = [0, 1000, -1000, 32767], extraChunk = false } = opts;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0); fmt.writeUInt32LE(16, 4); fmt.writeUInt16LE(1, 8); fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(sr, 12); fmt.writeUInt32LE(sr * channels * 2, 16); fmt.writeUInt16LE(channels * 2, 20); fmt.writeUInt16LE(bits, 22);
  const extra = extraChunk ? Buffer.concat([Buffer.from("LIST"), Buffer.from([3, 0, 0, 0]), Buffer.from("abc"), Buffer.from([0])]) : Buffer.alloc(0);
  const dh = Buffer.alloc(8); dh.write("data", 0); dh.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([Buffer.from("WAVE"), fmt, extra, dh, data]);
  const head = Buffer.alloc(8); head.write("RIFF", 0); head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]).toString("base64");
}

describe("parseWav", () => {
  it("reads PCM16 mono samples and the sample rate", () => {
    const r = parseWav(makeWav({ sr: 24000 }))!;
    expect(r.sampleRate).toBe(24000);
    expect([...r.pcm]).toEqual([0, 1000, -1000, 32767]);
  });
  it("skips unknown chunks (with odd-size padding)", () => {
    expect([...parseWav(makeWav({ extraChunk: true }))!.pcm]).toEqual([0, 1000, -1000, 32767]);
  });
  it("takes the first channel of stereo", () => {
    expect([...parseWav(makeWav({ channels: 2, samples: [1, 2, 3, 4] }))!.pcm]).toEqual([1, 3]);
  });
  it("rejects non-WAV data, other bit depths and garbage", () => {
    expect(parseWav(Buffer.from("hello world, not a wav").toString("base64"))).toBeNull();
    expect(parseWav(makeWav({ bits: 8 }))).toBeNull();
    expect(parseWav("%%%")).toBeNull();
  });
});
