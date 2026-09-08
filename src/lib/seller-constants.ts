/**
 * 賣方（屋主）資料庫 — 純常數（2026-08-22）
 *
 * ⚠️ 不 import db / 任何 server-only 模組，client 元件可安全 import。
 *
 * 為什麼賣方不能塞進買方那張表：
 *   買方的軸是「要什麼」（區域、預算、格局），賣方的軸是「為什麼賣、能讓多少」。
 *   同一個人今天是賣方、明天是買方（換屋客），但那是兩段完全不同的對話。
 *   混在一起的結果就是兩邊都只填得出一半欄位。
 *
 * 這裡的設計核心是一句房仲的老話：**成交價不是談出來的，是屋主的預期被現實修正出來的。**
 * 所以整張表在意的不是「他開多少」，而是「他為什麼開這個價、什麼情況下會改」。
 */

// ---- 委託階段 ----
export const SELLER_STAGES = [
  { key: "lead", label: "還沒簽委託", tone: "neutral", order: 1, hint: "談過但還沒拿到委託書" },
  { key: "listed", label: "委託銷售中", tone: "success", order: 2, hint: "正式在賣，要固定回報" },
  { key: "negotiating", label: "議價中", tone: "warn", order: 3, hint: "有斡旋或要約在桌上" },
  { key: "closed", label: "已成交", tone: "info", order: 4, hint: "簽約完成" },
  { key: "expired", label: "委託到期／收回", tone: "neutral", order: 5, hint: "沒續約或屋主不賣了" },
] as const;

export type SellerStageKey = (typeof SELLER_STAGES)[number]["key"];

export function sellerStageLabel(key: string): string {
  return SELLER_STAGES.find((s) => s.key === key)?.label ?? key;
}

/**
 * 賣的動機 —— 這是整張表最重要的一欄。
 * 動機決定他能不能等：等得起的人不會降價，等不起的人時間到了自己會鬆。
 */
export const SELL_MOTIVES = [
  { key: "upgrade", label: "換屋", emoji: "🔄", pressure: 3, hint: "新家已經簽了沒？簽了就有時間壓力" },
  { key: "cash", label: "資金需求", emoji: "💰", pressure: 4, hint: "壓力最大的一種，通常有明確期限" },
  { key: "inherit", label: "繼承／分產", emoji: "📜", pressure: 3, hint: "共有人愈多愈難談，先問誰能點頭" },
  { key: "relocate", label: "搬遷／工作異動", emoji: "🚚", pressure: 3, hint: "有搬家日就有底線" },
  { key: "invest", label: "投資獲利了結", emoji: "📈", pressure: 1, hint: "賣不掉就放著，最不急" },
  { key: "debt", label: "處分債務／法拍前", emoji: "⚠️", pressure: 5, hint: "有期限，但也最需要謹慎確認產權" },
  { key: "test", label: "只是試水溫", emoji: "👀", pressure: 0, hint: "開高價掛著看看，成交機率低" },
  { key: "unknown", label: "還沒問出來", emoji: "❓", pressure: 0, hint: "第一次見面就要問到這題" },
] as const;

export type SellMotiveKey = (typeof SELL_MOTIVES)[number]["key"];

export function motiveLabel(key: string): string {
  return SELL_MOTIVES.find((m) => m.key === key)?.label ?? key;
}

export function motivePressure(key: string | null | undefined): number {
  return SELL_MOTIVES.find((m) => m.key === key)?.pressure ?? 0;
}

/** 屋主的價格彈性 —— 講出來的話跟實際行為常常不一樣，所以分開記 */
export const PRICE_FLEX = [
  { key: "firm", label: "一毛不讓", emoji: "🧱", score: 0 },
  { key: "slight", label: "可以談一點", emoji: "🙂", score: 2 },
  { key: "open", label: "價格好談", emoji: "🤝", score: 4 },
  { key: "desperate", label: "只要能賣", emoji: "🔥", score: 5 },
  { key: "unknown", label: "沒表態", emoji: "❓", score: 1 },
] as const;

export function priceFlexLabel(key: string): string {
  return PRICE_FLEX.find((p) => p.key === key)?.label ?? key;
}

export function priceFlexScore(key: string | null | undefined): number {
  return PRICE_FLEX.find((p) => p.key === key)?.score ?? 0;
}

// ---- 聯絡紀錄類型 ----
// 跟買方那張表刻意不同：賣方的互動有一半是「我做了什麼給他看」（回報、廣告、帶看），
// 另一半才是「他說了什麼」。兩種都要記，回報表才組得出來。
export const SELLER_CONTACT_TYPES = [
  { key: "call", label: "通話", emoji: "📞", isReport: false },
  { key: "line", label: "LINE", emoji: "💬", isReport: false },
  { key: "meet", label: "面談／拜訪", emoji: "🤝", isReport: false },
  { key: "report", label: "屋主回報", emoji: "📣", isReport: true },
  { key: "viewing", label: "帶看回饋", emoji: "🔑", isReport: false },
  { key: "offer", label: "出價／斡旋", emoji: "💵", isReport: false },
  { key: "price_change", label: "調價", emoji: "🏷️", isReport: false },
  { key: "marketing", label: "行銷曝光", emoji: "📢", isReport: true },
  { key: "note", label: "備註", emoji: "📝", isReport: false },
] as const;

export type SellerContactTypeKey = (typeof SELLER_CONTACT_TYPES)[number]["key"];

export function sellerContactLabel(key: string): string {
  return SELLER_CONTACT_TYPES.find((t) => t.key === key)?.label ?? key;
}

export function sellerContactEmoji(key: string): string {
  return SELLER_CONTACT_TYPES.find((t) => t.key === key)?.emoji ?? "📝";
}

/**
 * 這次聯絡完，屋主的態度。
 * weight 是「離成交更近還是更遠」，累積起來就是意圖分數的行為軸。
 */
export const SELLER_SENTIMENTS = [
  { key: "cooperative", label: "配合、願意調整", tone: "success", weight: 2 },
  { key: "listening", label: "聽得進去", tone: "info", weight: 1 },
  { key: "neutral", label: "沒什麼反應", tone: "neutral", weight: 0 },
  { key: "resistant", label: "堅持己見", tone: "warn", weight: -1 },
  { key: "angry", label: "不高興／有情緒", tone: "danger", weight: -2 },
  { key: "conceded", label: "鬆口了", tone: "success", weight: 3 },
] as const;

export type SellerSentimentKey = (typeof SELLER_SENTIMENTS)[number]["key"];

export function sentimentLabel(key: string | null): string {
  return SELLER_SENTIMENTS.find((s) => s.key === key)?.label ?? "";
}

export function sentimentWeight(key: string | null): number {
  return SELLER_SENTIMENTS.find((s) => s.key === key)?.weight ?? 0;
}

// ---- 資料來源 ----
export const SELLER_SOURCES = [
  { key: "booking", label: "線上預約轉入" },
  { key: "develop", label: "開發電訪" },
  { key: "patrol", label: "巡商圈／自售紅單" },
  { key: "referral", label: "轉介紹" },
  { key: "old_client", label: "舊客回頭" },
  { key: "manual", label: "手動建檔" },
] as const;

export function sellerSourceLabel(key: string): string {
  return SELLER_SOURCES.find((s) => s.key === key)?.label ?? key;
}

/**
 * 委託中的屋主，幾天沒回報就算失職。
 *
 * 為什麼是 7 天：房仲業界的共識是「一週至少回報一次、有帶看當天就回報」。
 * 屋主抱怨房仲最常見的第一名不是賣不掉，是**找不到人、不知道你在幹嘛**。
 */
export const REPORT_DUE_DAYS = 7;

/** 委託到期前幾天要開始談續約 */
export const RENEWAL_WARNING_DAYS = 14;
