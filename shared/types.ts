import type { ActivityId, TeamId } from "./content";

export type Role = "visitor" | "local";
export type Phase = "lobby" | "dashboard" | "quiz" | "wall" | "awards";

export interface Profile { id: string; name: string; avatar: string; role: Role }

export interface PStats {
  toneCorrect: number; toneTotal: number; toneBestStreak: number;
  phrases: Record<string, number>; // phraseId -> best score
  snaps: number; questions: number; wishes: number; voices: number;
  quizCorrect: number; quizAnswered: number; bestDiscount: number; // %
  stamps: ActivityId[];
  words: string[];
}

export interface Participant extends Profile {
  team: TeamId; points: number; vnName?: string; vnMeaning?: string; vnSay?: string;
  joinedAt: number; lastSeen: number; hidden?: boolean; stats: PStats;
}

export interface FeedItem { id: string; at: number; avatar: string; name: string; team: TeamId; text: string; emoji: string }
export interface Wish { id: string; at: number; pid: string; name: string; avatar: string; team: TeamId; en: string; vi: string; hidden?: boolean }
export interface VoiceMeta { id: string; phraseId: string; pid: string; name: string; avatar: string }

export interface QuizPublic {
  index: number; status: "idle" | "open" | "reveal";
  remainingMs: number; durationMs: number;
  answeredCount: number; eligibleCount: number;
  counts?: number[]; // only at reveal
  fastest?: { name: string; avatar: string; team: TeamId; ms: number }[];
}

export interface Totals {
  participants: number; visitors: number; locals: number;
  phrasesSpoken: number; avgPronunciation: number; toneAccuracy: number; toneAnswers: number;
  snaps: number; aiChats: number; wishes: number; voices: number; quizAnswers: number; aiCalls: number;
}

export interface TeamScore { id: TeamId; points: number; members: number; bestDiscount: number }

export interface PublicState {
  serverTime: number; eventId: string; phase: Phase;
  lanterns: number; goal: number;
  quiz: QuizPublic;
  spotlight: { activity: ActivityId; at: number } | null;
  teams: TeamScore[]; totals: Totals;
  voices: VoiceMeta[];
  me?: Participant | null; myRank?: number;
  myQuiz?: { answered: boolean; choice?: number; correct?: boolean; points?: number };
}

export interface HostState extends PublicState {
  participants: Participant[];
  feed: FeedItem[];
  words: { w: string; n: number; en?: string }[];
  wishes: Wish[];
  recentJoins: { name: string; avatar: string; team: TeamId; at: number }[];
  awards: { title: string; emoji: string; name: string; avatar: string; detail: string }[];
}
