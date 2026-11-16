// Gemini gateway: JSON-schema output, LOW thinking for speed, a hard timeout, one
// retry on a lighter model, and a concurrency cap. Callers always provide a fallback.
import { GoogleGenAI, ThinkingLevel, Type, type Part, type Schema } from "@google/genai";

const PRIMARY = process.env.CULTURE_MODEL || "gemini-flash-latest";
const BACKUP = process.env.CULTURE_BACKUP_MODEL || "gemini-flash-lite-latest";
const TIMEOUT_MS = 20_000;

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
  return client;
}

// --- simple semaphore so a burst of 30 phones never floods the API
let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 16) await new Promise<void>((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

export const aiStats = { calls: 0, failures: 0, fallbacks: 0, totalMs: 0 };

async function callModel<T>(model: string, system: string, parts: Part[], schema: Schema, temperature: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await ai().models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: system, responseMimeType: "application/json", responseSchema: schema, temperature,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, abortSignal: ctrl.signal,
      },
    });
    const text = res.text;
    if (!text) throw new Error("empty response");
    return JSON.parse(text) as T;
  } finally { clearTimeout(timer); }
}

export async function generateJSON<T>(task: string, system: string, parts: Part[], schema: Schema, temperature = 0.7): Promise<T | null> {
  return slot(async () => {
    const t0 = Date.now();
    aiStats.calls++;
    for (const model of [PRIMARY, BACKUP]) {
      try {
        const out = await callModel<T>(model, system, parts, schema, temperature);
        aiStats.totalMs += Date.now() - t0;
        console.info(JSON.stringify({ culture: "ai", task, model, ms: Date.now() - t0, ok: true }));
        if (model === BACKUP) aiStats.fallbacks++;
        return out;
      } catch (e) {
        console.warn(JSON.stringify({ culture: "ai", task, model, ms: Date.now() - t0, ok: false, err: (e as Error).message?.slice(0, 200) }));
      }
    }
    aiStats.failures++;
    return null;
  });
}

const S = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({ type: Type.OBJECT, properties, required });
const str = (description?: string): Schema => ({ type: Type.STRING, description });

const PERSONA = `You are part of "Chào Việt Nam!", a fun live workshop where Australian high-school/university students learn Vietnamese language and culture with AI, alongside Vietnamese student buddies. Audience: beginners, English speakers. Be warm, accurate, concise, respectful and age-appropriate. Use correct Vietnamese with full diacritics. "say" fields are an easy English respelling for Australians (e.g. "Cảm ơn" → "gahm uhn").`;

// ------------------------------------------------------------------ features
export interface NameOut { vn_name: string; meaning: string; say: string; story: string }
export const nameSchema = S({ vn_name: str("2-word Vietnamese given name with diacritics, e.g. 'Minh Anh'"), meaning: str("meaning in English, under 8 words"), say: str(), story: str("one fun sentence (max 25 words) linking the name to the person and to Vietnamese culture") });
export async function aiName(first: string, about: string) {
  return generateJSON<NameOut>("name", PERSONA,
    [{ text: `Create a beautiful, positive Vietnamese given name (two syllables, a real common Vietnamese name) for a student named "${first}" who describes themself as: "${about || "curious and friendly"}". Prefer names that echo the sound of their name or reflect their description.` }],
    nameSchema, 1.0);
}

export interface PronOut { heard: string; matches: boolean }
// Prompt chosen by experiment (see plan §6): telling the model the target makes it
// better at hearing tones, and these strict rules stop it autocorrecting toward it:
// English "thank you" → "Thank you", a different phrase → that phrase, flat tones → no marks.
export async function aiPronounce(target: string, wavB64: string) {
  return generateJSON<PronOut>("pronounce",
    `You are a strict Vietnamese pronunciation examiner. You never flatter and never guess.`,
    [
      { inlineData: { mimeType: "audio/wav", data: wavB64 } },
      { text: `A beginner learner was asked to say the Vietnamese phrase "${target}". Listen like a strict examiner.
"heard": transcribe EXACTLY what was actually pronounced, in Vietnamese spelling with tone marks, syllable by syllable. NEVER autocorrect toward "${target}". Write the tone you actually hear on each syllable (no mark if it sounds level/flat). If they said different words (other Vietnamese words, or English such as "thank you"), write those words instead. Do not translate. If you hear no clear human speech, return "".
"matches": true only if what was pronounced is recognisably the target phrase.` },
    ],
    S({ heard: str(), matches: { type: Type.BOOLEAN } }), 0);
}

export interface SnapOut { found: boolean; en: string; vi: string; say: string; example_vi: string; example_en: string; culture: string; emoji: string }
export async function aiSnap(jpegB64: string) {
  return generateJSON<SnapOut>("snap", PERSONA,
    [{ inlineData: { mimeType: "image/jpeg", data: jpegB64 } },
     { text: `Identify the single most prominent object in this photo and teach its Vietnamese word. "vi": the everyday Vietnamese word (1-3 syllables, no classifier unless natural). "example_vi"/"example_en": a very short, useful beginner sentence using it. "culture": one surprising, true cultural fact connecting this object to life in Vietnam (max 30 words). "emoji": one emoji. If the photo is unclear or inappropriate, set found=false and fill other fields with gentle guidance.` }],
    S({ found: { type: Type.BOOLEAN }, en: str(), vi: str(), say: str(), example_vi: str(), example_en: str(), culture: str(), emoji: str() }), 0.4);
}

export interface GuideOut { answer: string; try_vi: string; try_en: string; try_say: string; followups: string[] }
export async function aiGuide(history: { role: "user" | "guide"; text: string }[]) {
  const convo = history.slice(-8).map((m) => `${m.role === "user" ? "Student" : "Cô Lan"}: ${m.text}`).join("\n");
  return generateJSON<GuideOut>("guide",
    `${PERSONA}\nYou are Cô Lan, a cheerful Vietnamese culture guide from Hội An. Answer in English in max 70 words, vivid and concrete, with 1 emoji. If the question is not about Vietnam, gently connect it to Vietnam. If you are unsure, say so honestly. Always teach one related Vietnamese word or short phrase in try_vi/try_en/try_say. followups: 3 short (max 7 words) curious follow-up questions the student might tap.`,
    [{ text: `Conversation so far:\n${convo}\n\nReply as Cô Lan to the student's last message.` }],
    S({ answer: str(), try_vi: str(), try_en: str(), try_say: str(), followups: { type: Type.ARRAY, items: str() } }), 0.8);
}

export interface MarketOut { vendor_vi: string; vendor_en: string; price: number; deal: boolean; suggestions: { vi: string; en: string }[] }
export async function aiMarket(item: { vi: string; en: string; start: number; floor: number }, current: number, history: { role: "user" | "vendor"; text: string }[], turn: number) {
  const convo = history.slice(-10).map((m) => `${m.role === "user" ? "Customer" : "Cô Hoa"}: ${m.text}`).join("\n");
  return generateJSON<MarketOut>("market",
    `${PERSONA}\nYou are Cô Hoa, a funny, theatrical vendor at Bến Thành market in Saigon, selling a ${item.en} (${item.vi}). Prices are in thousand đồng ("nghìn", e.g. 150 = 150 nghìn). Asking price was ${item.start}; your current price is ${current}; you will NEVER go below ${item.floor}.
Rules: Speak SHORT, simple Vietnamese (max 18 words) in vendor_vi, with an English translation in vendor_en. Bargain like a real friendly market vendor: complain playfully, then lower the price a little. Reward culture: if the customer uses Vietnamese (especially "Đắt quá", "bớt đi", "chị ơi"/"cô ơi", "cảm ơn") or is polite and funny, lower the price MORE; if they only speak English, lower it less. If they offer a reasonable price at or above ${item.floor}, you may accept. Set deal=true ONLY when the customer clearly agrees to buy at your price or you accept their offer; then "price" is the final price. This is turn ${turn}; by turn 7 make a "final offer".
suggestions: 3 short replies the customer could say next, in easy Vietnamese with English (e.g. a haggle line, a counter-offer with a number, and an accept line).`,
    [{ text: `${convo}\n\nReply as Cô Hoa.` }],
    S({ vendor_vi: str(), vendor_en: str(), price: { type: Type.NUMBER }, deal: { type: Type.BOOLEAN }, suggestions: { type: Type.ARRAY, items: S({ vi: str(), en: str() }) } }), 0.8);
}

export interface WishOut { safe: boolean; vi: string; back_en: string }
export async function aiWish(en: string) {
  return generateJSON<WishOut>("wish", PERSONA,
    [{ text: `Translate this short wish/message from a student into natural, warm Vietnamese (as a Vietnamese friend would write it), max 30 words. Then translate your Vietnamese back into English literally (back_en) so the student can check the meaning. safe=false if the message is rude, hateful, sexual, about self-harm, or mocks anyone; otherwise true.\nMessage: "${en}"` }],
    S({ safe: { type: Type.BOOLEAN }, vi: str(), back_en: str() }), 0.4);
}
