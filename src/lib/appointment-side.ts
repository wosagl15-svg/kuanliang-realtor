/**
 * 這場約是「買方線」還是「賣方線」（2026-08-22）
 *
 * 為什麼一定要分：
 *   談完之後兩邊該去的地方根本不同 ——
 *     買方 → 建進買方資料庫，才配得到物件、才進得了群發名單
 *     賣方 → 建進賣方資料庫，才記得住每次聯絡、才生得出屋主回報表
 *   不分的話，兩種人會一起躺在「預約管理」裡，永遠停在「談過了」這一格，
 *   沒有下一步。成交是在建檔之後才開始的，不是在見面那天結束。
 *
 * 判斷順序：客戶勾的意圖最準（表單就是問這個），其次才看備註關鍵字。
 * 兩邊都有 = 換屋客（同時要建兩邊，這種人最容易只建一半）。
 */

import type { AppointmentRow } from "@/lib/appointment-constants";

export type CaseSide = "buyer" | "seller" | "both" | "unknown";

const SELLER_HINTS = ["賣", "出售", "託售", "委託", "自售", "屋主", "求售", "處分", "脫手"];
const BUYER_HINTS = ["買", "看房", "找房", "自住", "置產", "投資", "換屋", "首購", "預算"];

function parseIntents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function caseSideOf(row: Pick<AppointmentRow, "intent" | "note">): CaseSide {
  const intents = parseIntents(row.intent);
  let buy = intents.includes("buy");
  let sell = intents.includes("sell");

  // 意圖沒勾（或只勾了「其他／法律諮詢」）時，退而用備註猜。
  // 猜錯的成本很低（就是多按一次另一邊），漏掉的成本很高（客戶沒建檔）。
  if (!buy && !sell) {
    const note = row.note || "";
    sell = SELLER_HINTS.some((k) => note.includes(k));
    buy = BUYER_HINTS.some((k) => note.includes(k));
  }

  if (buy && sell) return "both";
  if (sell) return "seller";
  if (buy) return "buyer";
  return "unknown";
}

export const SIDE_META: Record<CaseSide, { label: string; emoji: string; short: string }> = {
  buyer: { label: "買方線", emoji: "🏠", short: "買" },
  seller: { label: "賣方線", emoji: "🏷️", short: "賣" },
  both: { label: "換屋客（買＋賣）", emoji: "🔄", short: "買賣" },
  unknown: { label: "還沒分線", emoji: "❓", short: "未分" },
};

/**
 * 把這場約談到的東西，整理成可以直接貼進 AI 解析框的一段話。
 * 建檔頁吃的是「一段自然語言」，所以這裡不做欄位化，只把事實排好，
 * 業務接著把當場聊到的細節補在後面就能送出。
 */
export function prefillTextFor(row: AppointmentRow, side: "buyer" | "seller"): string {
  const lines = [
    `${row.name}${row.gender === "female" ? "（女）" : row.gender === "male" ? "（男）" : ""}`,
    row.phone ? `電話 ${row.phone}` : "",
    row.email ? `Email ${row.email}` : "",
    row.line_id ? `LINE ${row.line_id}` : "",
    row.note ? `預約時說：${row.note}` : "",
    row.urgency === "asap" ? "急迫度：這個月內要處理" : row.urgency === "soon" ? "急迫度：1–3 個月" : "",
    row.outcome_note ? `見面後記錄：${row.outcome_note}` : "",
    "",
    side === "buyer"
      ? "（以下補：想找的區域、預算、格局、幾樓、有無電梯車位、自住或投資、什麼時候要）"
      : "（以下補：物件地址或社區、坪數格局、屋齡樓層、開價、為什麼賣、什麼時候要賣掉）",
  ];
  return lines.filter(Boolean).join("\n");
}

/** 建檔連結：買方去買方資料庫、賣方去賣方資料庫，都帶著這場約的內容過去 */
export function buyerIntakeHref(row: AppointmentRow): string {
  const params = new URLSearchParams({
    prefill: prefillTextFor(row, "buyer"),
    from: row.case_no || row.id,
  });
  return `/admin/buyers/new?${params.toString()}`;
}

/**
 * 賣方走結構化欄位而不是一整塊 prefill 文字：
 * 賣方建檔表單本來就是一格一格填的（動機、價格彈性、決策者），
 * 塞一塊文字進去還要人再拆一次，等於白做。買方那邊是 AI 解析框，才適合整塊貼。
 */
export function sellerIntakeHref(row: AppointmentRow): string {
  const params = new URLSearchParams();
  params.set("name", row.name);
  if (row.phone) params.set("phone", row.phone);
  if (row.email) params.set("email", row.email);
  if (row.line_id) params.set("line", row.line_id);
  if (row.note) params.set("note", row.note);
  if (row.urgency) params.set("urgency", row.urgency);
  params.set("from", row.case_no || row.id);
  params.set("aid", row.id);
  return `/admin/sellers/new?${params.toString()}`;
}

/** 先查這個屋主建過沒 */
export function sellerLookupHref(row: AppointmentRow): string {
  return `/admin/sellers?q=${encodeURIComponent(row.phone || row.name)}`;
}

/** 先查有沒有建過，免得同一個人被建兩次 */
export function buyerLookupHref(row: AppointmentRow): string {
  return `/admin/buyers?q=${encodeURIComponent(row.phone || row.name)}`;
}
