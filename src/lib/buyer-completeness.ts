/**
 * 買方資料完整度與分級（2026-08-12）
 * ⚠️ 純函式，不 import db，client + server 共用。
 *
 * 系統擁有者拍板的兩件事：
 *  1. 分數只是報告，「缺什麼」才是行動。所以一定要回傳缺漏欄位的中文名稱，
 *     業務下次通話照著問，三分鐘就從 55% 變 90%。
 *  2. 完整度高 ≠ 意願高。很會填表的人可能只是好奇。
 *     所以分級走兩軸：資訊完整度 × 互動熱度，真正的 A 級是兩軸都高。
 */
import {
  COMPLETENESS_FIELDS,
  COMPLETENESS_TOTAL,
  DORMANT_DAYS,
  gradeOf,
} from "@/lib/buyer-constants";

/** 計分用的扁平輸入（由 buyer.ts 從 buyer + 當前需求 + 標籤組出來） */
export type CompletenessInput = {
  name?: string | null;
  phone_norm?: string | null;
  budget_max?: number | null;
  districts?: string[] | null;
  room_min?: number | null;
  parking?: string | null;
  elevator?: string | null;
  purpose?: string | null;
  size_min?: number | null;
  age_max?: number | null;
  tags?: string[] | null;
  decision_maker?: string | null;
  urgency?: string | null;
  funding_note?: string | null;
};

export type CompletenessResult = {
  pct: number;
  grade: "A" | "B" | "C" | "D";
  /** 已填欄位的中文名稱 */
  filled: string[];
  /** 缺漏欄位的中文名稱，依權重由高到低 —— 這是要顯示給業務看的行動清單 */
  missing: string[];
  /** 缺漏中最該先補的三個（列表頁一行放得下） */
  topMissing: string[];
};

/** 判斷一個欄位算不算「有填」。'any' / 'unknown' 這種預設值不算 —— 那是沒問，不是問了無所謂。 */
function isFilled(field: string, v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return false;
    // 這些是「還沒問」的預設值，不能算填了
    if (field === "elevator" || field === "parking") return s !== "any";
    if (field === "purpose") return s !== "unknown";
    return true;
  }
  if (typeof v === "number") {
    // room_min = 0 代表「不限」，那是有問過的答案，算填了
    if (field === "room_min") return true;
    return v > 0;
  }
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  let score = 0;
  const filled: string[] = [];
  const missingWithWeight: Array<{ label: string; weight: number }> = [];

  for (const f of COMPLETENESS_FIELDS) {
    const v = (input as Record<string, unknown>)[f.field];
    if (isFilled(f.field, v)) {
      score += f.weight;
      filled.push(f.label);
    } else {
      missingWithWeight.push({ label: f.label, weight: f.weight });
    }
  }

  const pct = Math.round((score / COMPLETENESS_TOTAL) * 100);
  missingWithWeight.sort((a, b) => b.weight - a.weight);
  const missing = missingWithWeight.map((m) => m.label);

  return {
    pct,
    grade: gradeOf(pct),
    filled,
    missing,
    topMissing: missing.slice(0, 3),
  };
}

// ---- 互動熱度（分級第二軸）----

export type HeatInput = {
  /** 近 90 天互動次數（通話／LINE／面談／帶看） */
  recentContacts: number;
  /** 帶看次數（不分時間）—— 願意花時間出來看房，意願最真實 */
  viewings: number;
  /** 收到推播後點擊次數 */
  clicks: number;
  /** 收到推播總次數（算點擊率用） */
  pushes: number;
  /** 距今幾天沒接觸 */
  daysSinceContact: number | null;
};

export type HeatResult = {
  score: number; // 0–100
  level: "熱" | "溫" | "冷" | "沉睡";
  reasons: string[];
};

export function computeHeat(input: HeatInput): HeatResult {
  const reasons: string[] = [];
  let score = 0;

  // 近期互動（最高 40）
  const c = Math.min(input.recentContacts, 8);
  score += c * 5;
  if (c >= 4) reasons.push(`近 90 天互動 ${input.recentContacts} 次`);

  // 帶看（最高 35）—— 權重最高，因為這是「用腳投票」
  const v = Math.min(input.viewings, 7);
  score += v * 5;
  if (v >= 1) reasons.push(`已帶看 ${input.viewings} 次`);

  // 推播點擊率（最高 25）
  if (input.pushes > 0) {
    const rate = input.clicks / input.pushes;
    score += Math.round(rate * 25);
    if (input.clicks > 0) reasons.push(`推播點擊 ${input.clicks}/${input.pushes}`);
  }

  // 近期接觸加分（最高 25）
  // 🔴 只算「幾次」不算「多近」會出錯：3 天前才帶看過的人被算成冷，業務就不會去跟進。
  //    剛聯絡過本身就是熱度訊號，權重要跟帶看同級。
  const d = input.daysSinceContact;
  if (d !== null) {
    if (d <= 7) {
      score += 25;
      reasons.push(d === 0 ? "今天剛聯絡" : `${d} 天前才聯絡過`);
    } else if (d <= 14) {
      score += 15;
    } else if (d <= 30) {
      score += 7;
    }
  }

  // 太久沒接觸倒扣
  if (d !== null && d > DORMANT_DAYS) {
    score = Math.round(score * 0.5);
    reasons.push(`已 ${d} 天沒接觸`);
  }

  score = Math.max(0, Math.min(100, score));

  let level: HeatResult["level"];
  if (d !== null && d > DORMANT_DAYS * 2) level = "沉睡";
  else if (score >= 55) level = "熱";
  else if (score >= 25) level = "溫";
  else level = "冷";

  return { score, level, reasons };
}

/**
 * 兩軸合起來的經營優先度 —— 決定明天早上先打給誰。
 * 資料完整且互動熱 = 真 A 級；資料完整但冷 = 該喚醒；資料不全但熱 = 該趕快補資料。
 */
export function priorityOf(
  completeness: CompletenessResult,
  heat: HeatResult,
): { label: string; tone: "success" | "warn" | "info" | "neutral"; action: string } {
  const dataOk = completeness.pct >= 50;
  const hot = heat.score >= 25;

  if (dataOk && hot)
    return { label: "優先經營", tone: "success", action: "資料齊、互動熱，有新案先推這批" };
  if (dataOk && !hot)
    return { label: "待喚醒", tone: "warn", action: `資料齊但${heat.level}，找個理由重新接觸` };
  if (!dataOk && hot)
    return {
      label: "趕快補資料",
      tone: "info",
      action: `有互動但資料缺：${completeness.topMissing.join("、") || "—"}`,
    };
  return { label: "低優先", tone: "neutral", action: "資料少又沒互動，先別花時間" };
}
