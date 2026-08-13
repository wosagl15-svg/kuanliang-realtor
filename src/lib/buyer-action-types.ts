/**
 * 買方 server action 的輸入／輸出型別（2026-08-12）
 *
 * 為什麼獨立一個檔：`"use server"` 檔案只能匯出 async 函式，
 * 型別跟著放會讓 Next.js 的 server action 檢查抱怨。
 * 抽出來後 client 元件也能安全 import（型別在編譯期就被抹掉）。
 */
import type { ExtractedBuyer } from "@/lib/buyer-extract";

export type ExtractActionResult = {
  ok: boolean;
  error?: string;
  data?: ExtractedBuyer;
  /** 這次是用哪個引擎解析的：ai = Claude（懂上下文）；rules = 規則比對（免費、沒金鑰也能跑） */
  engine?: "ai" | "rules";
  /** 程式端保險絲撈到的電話（AI 漏抽時的備援） */
  phonesFound?: string[];
  usage?: { inputTokens: number; outputTokens: number; costTwd: number };
  /** AI 抽到的社區名稱去比對主檔的結果，讓使用者一鍵掛上 */
  communityMatches?: Array<{
    query: string;
    hits: Array<{ id: string; name: string; matchKind: string }>;
  }>;
};

export type SaveBuyerInput = {
  /** 有值 = 更新既有買方（補資料），無值 = 新建 */
  buyerId?: string;
  name: string;
  phone: string;
  lineUserId?: string | null;
  email?: string | null;
  source: string;
  stage?: string;
  decisionMaker?: string | null;
  fundingNote?: string | null;
  urgency?: string | null;
  personalityNote?: string | null;
  // 需求
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetFlexPct?: number;
  districts: string[];
  roomMin?: number | null;
  elevator: string;
  parking: string;
  purpose: string;
  sizeMin?: number | null;
  sizeMax?: number | null;
  ageMax?: number | null;
  floorPref?: string | null;
  // 關聯
  tagNames: string[];
  communityIds: string[];
  // 稽核
  rawSourceText?: string | null;
  extractionMeta?: Record<string, { level: string; evidence: string | null }> | null;
  unclear?: string[];
};

/** 急迫度顯示文字（客戶端下拉用） */
export const URGENCY_LABELS: Record<string, string> = {
  unknown: "未提到",
  asap: "🔥 這個月內",
  soon: "🙂 1–3 個月",
  explore: "👀 先了解、還不急",
};
