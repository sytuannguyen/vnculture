import manifest from "../../shared/audioManifest.json";

const M = manifest as Record<string, string>;
let current: HTMLAudioElement | null = null;

export function stopAudio() { try { current?.pause(); } catch { /* */ } }

export function playUrl(url: string, rate = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    stopAudio();
    const a = new Audio(url);
    a.playbackRate = rate;
    current = a;
    a.onended = () => resolve();
    a.onerror = () => reject(new Error("audio"));
    a.play().catch(reject);
  });
}

function browserSpeak(text: string, rate = 0.85): Promise<void> {
  return new Promise((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "vi-VN"; u.rate = rate;
      const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith("vi"));
      if (v) u.voice = v;
      u.onend = () => resolve(); u.onerror = () => resolve();
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { resolve(); }
  });
}

/** Speak Vietnamese: pre-generated clip → server TTS → browser voice. */
export async function playVi(text: string, slow = false): Promise<void> {
  const rate = slow ? 0.7 : 1;
  const file = M[text];
  try {
    if (file) return await playUrl(`/audio/${file}`, rate);
    return await playUrl(`/api/tts?t=${encodeURIComponent(text)}`, rate);
  } catch {
    return browserSpeak(text, slow ? 0.6 : 0.85);
  }
}
