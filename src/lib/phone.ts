/**
 * 台灣電話正規化（2026-08-12）
 * ⚠️ 純函式，不 import db，client + server 共用。
 *
 * 為什麼要有這支：房仲最痛的是撞單和重複建檔。同一個人會被存成
 * 「0912-345-678」「0912 345 678」「+886912345678」「886-912-345-678」，
 * 沒正規化就是四筆不同的客戶。正規化後當唯一鍵，建檔時撞號直接跳警告。
 */

/**
 * 把各種寫法統一成 09xxxxxxxx（手機）或 0Xxxxxxxx（市話含區碼）。
 * 認不出來的回 null —— 寧可留白，不要硬猜一個錯的鍵。
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // 只留數字與開頭的 +（分機用 # 或 ext 分隔的，取 # 前面那段）
  let s = String(input).trim().split(/[#＃]|ext\.?/i)[0] ?? "";
  s = s.replace(/[^\d+]/g, "");
  if (!s) return null;

  // +886 / 886 國碼 → 補回 0
  //   +886912345678 → 0912345678
  //   886912345678  → 0912345678
  //   +886 4 2665 xxxx → 042665xxxx
  s = s.replace(/^\+?886/, "0");
  // 上一步若原本就是 0 開頭又被誤加（例 "8860912..."）→ 會變成 "00912..."，收斂掉多餘的 0
  s = s.replace(/^0{2,}/, "0");

  if (!s.startsWith("0")) s = "0" + s;

  // 手機：09 開頭共 10 碼
  if (/^09\d{8}$/.test(s)) return s;

  // 市話：區碼 2~4 碼 + 號碼，總長 9~10 碼（台中 04、台北 02、金門 082…）
  if (/^0\d{8,9}$/.test(s)) return s;

  return null;
}

/** 是否為手機號（推播只能發手機／LINE，市話不能發簡訊） */
export function isMobile(normalized: string | null): boolean {
  return !!normalized && /^09\d{8}$/.test(normalized);
}

/** 顯示用格式：0912-345-678 / 04-2665-1234 */
export function formatPhone(normalized: string | null | undefined): string {
  if (!normalized) return "";
  if (/^09\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 7)}-${normalized.slice(7)}`;
  }
  if (/^0[2-8]\d{7,8}$/.test(normalized)) {
    const area = normalized.slice(0, 2);
    const rest = normalized.slice(2);
    return rest.length === 8 ? `${area}-${rest.slice(0, 4)}-${rest.slice(4)}` : `${area}-${rest}`;
  }
  return normalized;
}

/** 遮蔽顯示（列表頁 / 匯出預覽用，降低個資外洩面）：0912-***-678 */
export function maskPhone(normalized: string | null | undefined): string {
  if (!normalized) return "";
  if (/^09\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-***-${normalized.slice(7)}`;
  }
  return normalized.slice(0, 3) + "*".repeat(Math.max(0, normalized.length - 6)) + normalized.slice(-3);
}

/**
 * 從一段自由文字（LINE 對話 / 逐字稿）裡撈出所有電話。
 * 用途：AI 抽取之外的保險絲 —— 就算 AI 漏抽，也不會把客戶電話弄丟。
 */
export function extractPhones(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  // 涵蓋 0912345678 / 0912-345-678 / 0912 345 678 / +886912345678 / (04)2665-1234
  const re = /(?:\+?886[\s-]?|\(?0\)?)[\s-]?\d{1,4}[\s)-]?\d{3,4}[\s-]?\d{3,4}/g;
  for (const raw of text.match(re) ?? []) {
    const n = normalizePhone(raw);
    if (n) found.add(n);
  }
  return [...found];
}
