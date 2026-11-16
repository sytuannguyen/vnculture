// All curated workshop content. Shared by the client and the server, and read by
// scripts/gen-audio.mjs (via shared/audioTexts.json) to pre-generate audio.

export type TeamId = "pho" | "banhmi" | "sen" | "rong";
export interface Team { id: TeamId; name: string; vi: string; emoji: string; color: string; soft: string }
export const TEAMS: Team[] = [
  { id: "pho", name: "Team Phở", vi: "Phở", emoji: "🍜", color: "#E0412F", soft: "#FDE3DE" },
  { id: "banhmi", name: "Team Bánh Mì", vi: "Bánh Mì", emoji: "🥖", color: "#E39A12", soft: "#FCEFD2" },
  { id: "sen", name: "Team Đào", vi: "Hoa Đào", emoji: "🌸", color: "#DD5B92", soft: "#FBE1EC" },
  { id: "rong", name: "Team Rồng", vi: "Rồng", emoji: "🐉", color: "#13957E", soft: "#D7F2EC" },
];
export const teamById = (id: string) => TEAMS.find((t) => t.id === id) ?? TEAMS[0];

export const AVATARS = ["🐨", "🦘", "🐉", "🐃", "🦜", "🐢", "🐠", "🦊", "🐼", "🐯", "🦋", "🐘"];

export type ActivityId = "name" | "tones" | "say" | "snap" | "market" | "guide" | "wish";
export interface Activity { id: ActivityId; title: string; sub: string; emoji: string; color: string; ai: string }
export const ACTIVITIES: Activity[] = [
  { id: "name", title: "My Vietnamese Name", sub: "AI creates a name just for you", emoji: "🏷️", color: "#C8102E", ai: "Personalisation" },
  { id: "tones", title: "The Six Tones", sub: "Hear it, see it, catch it", emoji: "🎵", color: "#7B4BD6", ai: "Interactive drill" },
  { id: "say", title: "Say it! AI Coach", sub: "Speak, and AI tells you what it heard", emoji: "🎤", color: "#1F9D8B", ai: "Speech feedback" },
  { id: "snap", title: "Snap & Learn", sub: "Photo anything → Vietnamese", emoji: "📸", color: "#2F6FDB", ai: "Computer vision" },
  { id: "market", title: "Bargain at Bến Thành", sub: "Haggle with an AI market vendor", emoji: "🛍️", color: "#E39A12", ai: "Role-play" },
  { id: "guide", title: "Ask Cô Lan", sub: "Your AI culture guide", emoji: "🏮", color: "#DD5B92", ai: "Culture Q&A" },
  { id: "wish", title: "Lantern Wish", sub: "Your wish, in Vietnamese, on the big screen", emoji: "💌", color: "#B5452B", ai: "Translation" },
];

// ---------------------------------------------------------------- Tones
export type ToneId = 0 | 1 | 2 | 3 | 4 | 5;
export interface ToneInfo { id: ToneId; name: string; mark: string; english: string; color: string; ma: string; maMeaning: string; curve: string; gesture: string }
// SVG path (viewBox 0 0 100 60, y=0 high pitch) for each tone contour.
export const TONES: ToneInfo[] = [
  { id: 0, name: "ngang", mark: "no mark", english: "level", color: "#2F6FDB", ma: "ma", maMeaning: "ghost 👻", curve: "M8 22 L92 22", gesture: "Keep it flat and steady, mid-high" },
  { id: 1, name: "sắc", mark: "á", english: "rising", color: "#E0412F", ma: "má", maMeaning: "mother 👩", curve: "M8 40 Q60 36 92 6", gesture: "Swing up, like asking “huh?”" },
  { id: 2, name: "huyền", mark: "à", english: "falling", color: "#13957E", ma: "mà", maMeaning: "but 🤷", curve: "M8 30 Q50 38 92 50", gesture: "Relax and fall gently, low and breathy" },
  { id: 3, name: "hỏi", mark: "ả", english: "dipping", color: "#7B4BD6", ma: "mả", maMeaning: "tomb 🪦", curve: "M8 28 Q40 58 64 50 Q80 44 92 30", gesture: "Dip down then come back up, like a question" },
  { id: 4, name: "ngã", mark: "ã", english: "broken rising", color: "#E39A12", ma: "mã", maMeaning: "horse 🐎", curve: "M8 30 L44 38 L52 46 L60 26 L92 6", gesture: "Rise, catch in the throat, then jump up" },
  { id: 5, name: "nặng", mark: "ạ", english: "heavy drop", color: "#B5452B", ma: "mạ", maMeaning: "rice seedling 🌱", curve: "M8 34 Q50 40 70 56 L74 58", gesture: "Short, heavy, drop and stop" },
];
export const TONE_BASES = ["ma", "ba", "ta", "la"];
const TONE_VOWEL: Record<string, string[]> = { a: ["a", "á", "à", "ả", "ã", "ạ"] };
export function withTone(base: string, tone: ToneId): string {
  return base.replace(/a/, TONE_VOWEL.a[tone]);
}

// ---------------------------------------------------------------- Phrases
export interface Phrase { id: string; vi: string; say: string; en: string; emoji: string; note: string }
export const PHRASES: Phrase[] = [
  { id: "xinchao", vi: "Xin chào", say: "sin chow", en: "Hello", emoji: "👋", note: "To be polite to someone older, add “ạ”: Chào cô ạ! (Hello, madam!)" },
  { id: "camon", vi: "Cảm ơn", say: "gahm uhn", en: "Thank you", emoji: "🙏", note: "“Cảm” uses the dipping hỏi tone: dip down, come back up." },
  { id: "khongcogi", vi: "Không có gì", say: "khom gaw zee", en: "You're welcome", emoji: "😊", note: "Literally “it's nothing”. Southerners say “gì” like “yee”." },
  { id: "xinloi", vi: "Xin lỗi", say: "sin loy", en: "Sorry / Excuse me", emoji: "🙇", note: "Also used to get attention politely, like “excuse me”." },
  { id: "tenla", vi: "Tôi tên là", say: "toy ten lah", en: "My name is…", emoji: "🙋", note: "Add your name after it: Tôi tên là Emma." },
  { id: "tuuc", vi: "Tôi đến từ Úc", say: "toy den tuh ook", en: "I'm from Australia", emoji: "🦘", note: "Úc means Australia. Kangaroo is “chuột túi”: literally “pocket mouse”!" },
  { id: "baonhieu", vi: "Bao nhiêu tiền?", say: "bow nyew tee-en", en: "How much is it?", emoji: "💸", note: "The magic market question. Prices are often in thousands: “năm mươi nghìn” = 50,000 đồng." },
  { id: "datqua", vi: "Đắt quá!", say: "dut kwah", en: "Too expensive!", emoji: "😱", note: "Say it with a smile: bargaining is friendly theatre in Vietnamese markets." },
  { id: "ngonqua", vi: "Ngon quá!", say: "ngon kwah", en: "So delicious!", emoji: "😋", note: "The best compliment for any cook. “ng” is the sound at the end of “sing”." },
  { id: "mothaiba", vi: "Một, hai, ba, dô!", say: "moht, hai, bah, yo!", en: "One, two, three, cheers!", emoji: "🥤", note: "Heard at every Vietnamese gathering: everyone clinks glasses together." },
  { id: "hengaplai", vi: "Hẹn gặp lại", say: "hen gup lie", en: "See you again", emoji: "🤝", note: "Warmer than goodbye: it promises you will meet again." },
  { id: "tambiet", vi: "Tạm biệt", say: "tahm bee-et", en: "Goodbye", emoji: "👋", note: "“Tạm” means temporary: it's a goodbye for now." },
];

// ---------------------------------------------------------------- Market
export interface MarketItem { id: string; vi: string; en: string; emoji: string; start: number; floor: number }
export const MARKET_ITEMS: MarketItem[] = [
  { id: "nonla", vi: "nón lá", en: "conical palm-leaf hat", emoji: "👒", start: 250, floor: 110 },
  { id: "phin", vi: "phin cà phê", en: "Vietnamese coffee filter", emoji: "☕", start: 150, floor: 65 },
  { id: "aothun", vi: "áo thun “I ♥ VN”", en: "“I ♥ VN” T-shirt", emoji: "👕", start: 200, floor: 85 },
];
export const MARKET_GREETING = (item: MarketItem) =>
  `Chào em! Mua ${item.vi} không? Đẹp lắm! ${item.start} nghìn thôi!`;

// ---------------------------------------------------------------- Quiz
export type QuizKind = "mcq" | "tone" | "poll" | "ailocal";
export interface QuizQ { id: string; round: 1 | 2 | 3; kind: QuizKind; q: string; options: string[]; answer: number; fact: string; seconds: number; audio?: string; emoji: string }
export const QUIZ: QuizQ[] = [
  { id: "q1", round: 1, kind: "mcq", emoji: "🍜", q: "Phở, Vietnam's famous noodle soup, was born in which region?", options: ["The North (Hà Nội & Nam Định)", "The South (Saigon)", "The Mekong Delta", "The Central Highlands"], answer: 0, seconds: 20, fact: "Phở appeared in northern Vietnam in the early 1900s. Southern phở is sweeter and comes with a mountain of fresh herbs and bean sprouts." },
  { id: "q2", round: 1, kind: "mcq", emoji: "🧧", q: "At Tết (Lunar New Year), what do children receive in little red envelopes?", options: ["Candy", "Lucky money (lì xì)", "Letters from ancestors", "Rice seeds"], answer: 1, seconds: 20, fact: "Tết is Vietnam's biggest holiday. Lì xì is given in crisp new notes for a fresh, lucky start to the year." },
  { id: "q3", round: 1, kind: "mcq", emoji: "👗", q: "What is the áo dài?", options: ["A rice-paper roll", "A conical hat", "A long silk tunic worn over trousers", "A traditional dance"], answer: 2, seconds: 20, fact: "Áo dài literally means “long shirt”. Many high-school girls wear a white áo dài as their school uniform." },
  { id: "q4", round: 1, kind: "mcq", emoji: "☕", q: "Hà Nội is famous for “cà phê trứng”. What is it?", options: ["Coconut coffee", "Egg coffee", "Salt coffee", "Coffee with yoghurt"], answer: 1, seconds: 20, fact: "Egg coffee was invented in 1946 when milk was scarce: egg yolk whipped with sugar into a creamy foam on top of strong coffee." },
  { id: "q5", round: 1, kind: "mcq", emoji: "🥢", q: "Which of these is bad manners at a Vietnamese meal?", options: ["Sharing dishes from the middle", "Inviting elders to eat first", "Sticking chopsticks upright in your rice", "Saying “Mời cả nhà ăn cơm”"], answer: 2, seconds: 20, fact: "Upright chopsticks look like incense sticks at an altar for the dead. Before eating, the young invite the elders: “Mời ông bà ăn cơm!”" },
  { id: "q6", round: 1, kind: "mcq", emoji: "🏮", q: "Hội An's old town is world-famous for…", options: ["Silk lanterns", "Snowy mountains", "Pyramids", "Kangaroos"], answer: 0, seconds: 15, fact: "Hội An is a UNESCO World Heritage town. Every full moon, the lights go out and the old town glows with lanterns." },
  { id: "q7", round: 1, kind: "mcq", emoji: "👨‍👩‍👧", q: "In Vietnamese, the words for “I” and “you” depend on…", options: ["The weather", "Age and relationship", "The time of day", "How tall you are"], answer: 1, seconds: 20, fact: "You call an older man “anh” (big brother), an older woman “chị”, someone younger “em”, and elders “cô, chú, bác, ông, bà”." },
  { id: "q8", round: 1, kind: "mcq", emoji: "🔤", q: "Which alphabet does Vietnamese use today?", options: ["Chinese characters", "Its own unique script", "The Latin alphabet with tone marks", "The Cyrillic alphabet"], answer: 2, seconds: 15, fact: "Modern Vietnamese is written in chữ Quốc ngữ: Latin letters plus marks for tones and vowels. Centuries ago, scholars wrote in Chinese characters and chữ Nôm." },
  { id: "q9", round: 2, kind: "tone", emoji: "🐎", q: "Listen! Which word did you hear?", options: ["mà", "mã", "má", "mạ"], answer: 1, seconds: 20, audio: "mã", fact: "Mã (ngã tone: rise, break, jump up) means horse. Mà means “but”, má “mother”, mạ “rice seedling”." },
  { id: "q10", round: 2, kind: "tone", emoji: "👵", q: "Listen! Which word did you hear?", options: ["ba", "bá", "bà", "bạ"], answer: 2, seconds: 20, audio: "bà", fact: "Bà (huyền tone: low and falling) means grandmother. Ba means “three” or “dad” in the South." },
  { id: "q11", round: 2, kind: "mcq", emoji: "😋", q: "Your friend's mum cooks for you. What do you say?", options: ["Đắt quá!", "Ngon quá!", "Tạm biệt!", "Xin lỗi!"], answer: 1, seconds: 15, fact: "Ngon quá! = So delicious! Đắt quá! is for the market. Mixing them up will make everyone laugh." },
  { id: "q12", round: 2, kind: "tone", emoji: "🌱", q: "Listen! Which word did you hear?", options: ["ma", "mả", "mạ", "má"], answer: 2, seconds: 20, audio: "mạ", fact: "Mạ (nặng tone: short, heavy drop) is a young rice seedling, a symbol of the Vietnamese countryside." },
  { id: "q13", round: 2, kind: "ailocal", emoji: "🍚", q: "An AI said: “Vietnamese people often greet each other with ‘Ăn cơm chưa?’ (Have you eaten yet?)”. Is the AI right? Local buddies, help!", options: ["True ✅", "False ❌"], answer: 0, seconds: 20, fact: "True! It's a caring greeting, especially among older people: it means “I care about you”, not an invitation to lunch." },
  { id: "q14", round: 2, kind: "ailocal", emoji: "🌙", q: "An AI said: “In Vietnam, phở is mainly eaten as a dinner dish.” Is the AI right? Local buddies, help!", options: ["True ✅", "False ❌"], answer: 1, seconds: 20, fact: "False! Phở is classically a breakfast food, eaten early in the morning at street stalls, although today you can find it all day. AI can be confidently wrong: always check with real people!" },
  { id: "q15", round: 2, kind: "mcq", emoji: "🛵", q: "Roughly how many motorbikes are registered in Vietnam (population ~100 million)?", options: ["About 1 million", "About 10 million", "About 30 million", "More than 70 million"], answer: 3, seconds: 15, fact: "More than 70 million! Whole families, fridges and even pigs ride on motorbikes through Hà Nội and Saigon." },
  { id: "p1", round: 3, kind: "poll", emoji: "🤖", q: "How much did AI help you learn Vietnamese today?", options: ["🤯 Massively", "👍 A lot", "🙂 A bit", "😐 Not really"], answer: -1, seconds: 25, fact: "AI gives every learner a patient tutor, 24/7: personalised, private and judgement-free." },
  { id: "p2", round: 3, kind: "poll", emoji: "🏆", q: "Which AI superpower helped you most?", options: ["🎤 Pronunciation coach", "📸 Camera translation", "🛍️ Role-play practice", "🏮 Culture Q&A"], answer: -1, seconds: 25, fact: "Each one is a different way to learn: listening, seeing, doing and asking." },
  { id: "p3", round: 3, kind: "poll", emoji: "❤️", q: "What can AI NOT replace when learning a culture?", options: ["🤝 Real friends", "🍜 Tasting real phở", "🎉 Living the festivals", "😄 All of the above"], answer: -1, seconds: 25, fact: "AI is a brilliant tutor, but culture lives in people. Cảm ơn the local buddies! ❤️" },
];
export const QUIZ_ROUND_NAMES: Record<number, string> = { 1: "Round 1 · Culture", 2: "Round 2 · Language & AI or Local?", 3: "Reflection polls" };

// ---------------------------------------------------------------- Fallback names
export const FALLBACK_NAMES: { name: string; meaning: string; say: string }[] = [
  { name: "Minh Anh", meaning: "bright and brilliant", say: "ming ahn" },
  { name: "Bảo Ngọc", meaning: "precious jade", say: "bow ngop" },
  { name: "Hải Đăng", meaning: "lighthouse: a light for others", say: "hai dahng" },
  { name: "Thu Hà", meaning: "autumn river", say: "too hah" },
  { name: "Gia Bảo", meaning: "family treasure", say: "zah bow" },
  { name: "Lan Chi", meaning: "orchid and fragrant herb", say: "lahn chee" },
  { name: "Quang Huy", meaning: "shining glory", say: "kwahng hwee" },
  { name: "Mai Linh", meaning: "apricot blossom spirit", say: "my ling" },
  { name: "Trung Kiên", meaning: "loyal and steadfast", say: "choong kee-en" },
  { name: "Ngọc Hân", meaning: "joyful jewel", say: "ngop hun" },
  { name: "Phong Vũ", meaning: "wind and rain: free spirit", say: "fong voo" },
  { name: "Thảo Vy", meaning: "kind and delicate herb", say: "tao vee" },
  { name: "Đức An", meaning: "virtue and peace", say: "duc ahn" },
  { name: "Hoa Sen", meaning: "lotus flower", say: "hwah sen" },
  { name: "Sơn Lâm", meaning: "mountain forest", say: "shun lum" },
  { name: "Khánh Linh", meaning: "joyful bell", say: "khahn ling" },
];

export const LOCAL_TONE_HINT = "Southern speakers often merge hỏi and ngã. Both are right!";

// Texts that get pre-generated audio (scripts/gen-audio.mjs).
export function allStaticAudioTexts(): string[] {
  const set = new Set<string>();
  for (const b of TONE_BASES) for (const t of TONES) set.add(withTone(b, t.id));
  for (const p of PHRASES) set.add(p.vi);
  for (const q of QUIZ) if (q.audio) set.add(q.audio);
  for (const it of MARKET_ITEMS) set.add(MARKET_GREETING(it));
  for (const n of FALLBACK_NAMES) set.add(n.name);
  return [...set];
}
