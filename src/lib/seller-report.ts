/**
 * 屋主回報表（2026-08-22）
 *
 * 屋主對房仲最大的抱怨，第一名從來不是「賣不掉」，是**不知道你在幹嘛**。
 * 所以這張表的設計原則只有一條：
 *
 *   ⚠️ **只講事實與數字，不要出現「還在努力」「有在幫您看」這種話。**
 *
 * 它把兩種資料湊在一起：
 *   ① 我們自己資料庫裡本來就有的（帶看幾組、推給幾個買方、買方嫌什麼、有沒有人出價）
 *      —— 全自動，業務只要平常有記帶看，這裡就長得出來。
 *   ② 外部平台的曝光數字（591 瀏覽／收藏、社群觸及、公司內網）
 *      —— 這些數字在別人家的後台，程式抓不到，所以做成手動填，
 *         並且在畫面上直接寫「去哪裡抄這個數字」。
 *
 * 為什麼不去爬 591：系統擁有者早就拍板過不接、不爬任何外部網站
 * （違反使用條款、資料會過期）。這裡沿用同一條線。
 *
 * 最後產出一段可以直接貼進 LINE 的文字 —— 因為屋主九成是在 LINE 上讀這個，
 * 不是打開一個網頁。
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ensureSellerTables } from "@/lib/seller-schema";
import { ensureBuyerTables } from "@/lib/buyer-schema";
import { matchBuyersForListing } from "@/lib/buyer-match";
import { REACTIONS } from "@/lib/buyer-constants";
import type { ListingRow } from "@/lib/buyer-match";
import { OWNER } from "@/config/owner";

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** 手動填的外部數字。每一項都附「去哪抓」，不然沒人知道要填什麼。 */
export const MANUAL_METRICS = [
  {
    key: "p591_views",
    label: "591 瀏覽次數",
    where: "591 房仲後台 → 我的物件 → 該物件 → 「瀏覽數」",
    unit: "次",
  },
  {
    key: "p591_favs",
    label: "591 收藏數",
    where: "591 房仲後台 → 我的物件 → 該物件 → 「收藏數」",
    unit: "人",
  },
  {
    key: "p591_contacts",
    label: "591 來電／詢問",
    where: "591 房仲後台 → 通話紀錄／訊息",
    unit: "組",
  },
  {
    key: "company_views",
    label: "公司官網物件頁瀏覽",
    where: "公司內部系統的物件後台（各品牌位置不同：通常在「我的物件 → 成效／點閱」）",
    unit: "次",
  },
  {
    key: "social_reach",
    label: "社群貼文觸及",
    where: "FB 粉專 → 專業主頁管理套件 → 洞察報告 → 該篇貼文的「觸及人數」",
    unit: "人",
  },
  {
    key: "social_posts",
    label: "社群曝光次數",
    where: "自己數：這段期間為這間房發過幾則貼文／短影音",
    unit: "則",
  },
  {
    key: "flyers",
    label: "派報／紙本廣告",
    where: "自己數：這段期間發了幾份、貼了幾個點",
    unit: "份",
  },
] as const;

export type ManualMetricKey = (typeof MANUAL_METRICS)[number]["key"];

export type ReportAuto = {
  /** 帶看：不重複的買方組數 */
  viewings: number;
  viewingBuyers: number;
  /** 推案：主動推給幾個買方看資料 */
  pitches: number;
  /** 系統裡條件符合的買方數 */
  matchedBuyers: number;
  /** 有人出價／下斡旋 */
  offers: number;
  /** 買方反應分佈 */
  reactions: Array<{ key: string; label: string; count: number }>;
  /** 買方看完不喜歡時說了什麼 —— 說服屋主調價最有力的東西 */
  objections: string[];
  /** 這段期間我們主動做的行銷動作（來自 seller_contact_log type=marketing） */
  marketingActions: Array<{ at: Date; content: string }>;
  /** 這段期間跟屋主聯絡了幾次 */
  contactsWithOwner: number;
};

export type ReportManual = Partial<Record<ManualMetricKey, number>>;

export type SellerReportRow = {
  id: string;
  seller_id: string;
  listing_id: string | null;
  period_start: Date;
  period_end: Date;
  auto_json: string | null;
  manual_json: string | null;
  summary: string | null;
  suggestion: string | null;
  sent_at: Date | null;
  sent_channel: string | null;
  created_by: string | null;
  created_at: Date;
};

/**
 * 從資料庫把「這段期間我們為這間房做了什麼」算出來。
 *
 * 帶看與推案的來源是**買方**那張 buyer_contact_log —— 因為帶看本來就是記在買方身上的
 * （誰去看的）。屋主這邊不重複記一次，避免兩張表對不起來。
 */
export async function computeReportAuto(
  listingId: string | null,
  sellerId: string,
  from: Date,
  to: Date,
): Promise<ReportAuto> {
  await ensureBuyerTables();
  await ensureSellerTables();

  const empty: ReportAuto = {
    viewings: 0,
    viewingBuyers: 0,
    pitches: 0,
    matchedBuyers: 0,
    offers: 0,
    reactions: [],
    objections: [],
    marketingActions: [],
    contactsWithOwner: 0,
  };

  // 跟屋主本人的聯絡次數（不分物件）
  const ownerRows = await db.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM seller_contact_log
      WHERE seller_id = ? AND occurred_at BETWEEN ? AND ?`,
    sellerId,
    from,
    to,
  );
  empty.contactsWithOwner = Number(ownerRows[0]?.n ?? 0);

  const marketingRows = await db.$queryRawUnsafe<Array<{ occurred_at: Date; content: string | null }>>(
    `SELECT occurred_at, content FROM seller_contact_log
      WHERE seller_id = ? AND type = 'marketing' AND occurred_at BETWEEN ? AND ?
      ORDER BY occurred_at ASC LIMIT 50`,
    sellerId,
    from,
    to,
  );
  empty.marketingActions = marketingRows.map((r) => ({ at: new Date(r.occurred_at), content: r.content ?? "" }));

  // 沒掛物件就只能給屋主聯絡與行銷的部分 —— 帶看是綁在物件上的
  if (!listingId) return empty;

  const logs = await db.$queryRawUnsafe<
    Array<{ buyer_id: string; type: string; reaction: string | null; content: string | null }>
  >(
    `SELECT buyer_id, type, reaction, content FROM buyer_contact_log
      WHERE listing_id = ? AND occurred_at BETWEEN ? AND ?`,
    listingId,
    from,
    to,
  );

  const viewingLogs = logs.filter((l) => l.type === "viewing");
  const pitchLogs = logs.filter((l) => l.type === "pitch");

  const reactionCounts = new Map<string, number>();
  const objections: string[] = [];
  for (const l of viewingLogs) {
    if (l.reaction) reactionCounts.set(l.reaction, (reactionCounts.get(l.reaction) ?? 0) + 1);
    // 只收「沒感覺／不喜歡」的原話。喜歡的話對調價談判沒幫助，
    // 而且把好話一起放進去，屋主只會看到好話。
    if ((l.reaction === "disliked" || l.reaction === "meh") && l.content) {
      const text = l.content.replace(/^【.*?】/, "").trim();
      if (text) objections.push(text);
    }
  }

  const match = await matchBuyersForListing(listingId, { limit: 200 }).catch(() => null);

  return {
    ...empty,
    viewings: viewingLogs.length,
    viewingBuyers: new Set(viewingLogs.map((l) => l.buyer_id)).size,
    pitches: pitchLogs.length,
    matchedBuyers: match?.matched.length ?? 0,
    offers: viewingLogs.filter((l) => l.reaction === "offered").length,
    reactions: [...reactionCounts.entries()]
      .map(([key, count]) => ({
        key,
        label: REACTIONS.find((r) => r.key === key)?.label ?? key,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    objections: objections.slice(0, 8),
  };
}

function fmtDate(d: Date): string {
  const tw = new Date(new Date(d).getTime() + 8 * 60 * 60_000);
  return `${tw.getUTCMonth() + 1}/${tw.getUTCDate()}`;
}

/**
 * 組出可以直接貼進 LINE 的回報文字。
 *
 * 刻意用純文字＋條列，不用表格符號 —— LINE 的等寬對不齊，表格貼過去會亂掉。
 * 也刻意不寫「我們很努力」，只寫做了什麼、結果是什麼、建議怎麼辦。
 */
export function buildReportMessage(input: {
  sellerName: string;
  listing: ListingRow | null;
  from: Date;
  to: Date;
  auto: ReportAuto;
  manual: ReportManual;
  suggestion?: string | null;
}): string {
  const { sellerName, listing, from, to, auto, manual } = input;
  const lines: string[] = [];

  lines.push(`${sellerName}您好，這是 ${fmtDate(from)}–${fmtDate(to)} 的銷售回報：`);
  // 沒掛物件時不要留一行空的 —— 貼到 LINE 會多一個突兀的空白段
  if (listing) {
    lines.push("");
    lines.push(`【物件】${listing.title}${listing.price ? `　開價 ${listing.price} 萬` : ""}`);
  }

  // ── 曝光 ──
  const exposure: string[] = [];
  if (manual.p591_views) exposure.push(`591 瀏覽 ${manual.p591_views} 次`);
  if (manual.p591_favs) exposure.push(`收藏 ${manual.p591_favs} 人`);
  if (manual.company_views) exposure.push(`公司官網 ${manual.company_views} 次`);
  if (manual.social_reach) exposure.push(`社群觸及 ${manual.social_reach} 人`);
  if (manual.social_posts) exposure.push(`發文 ${manual.social_posts} 則`);
  if (manual.flyers) exposure.push(`派報 ${manual.flyers} 份`);
  if (exposure.length) {
    lines.push("");
    lines.push("【曝光】");
    lines.push(exposure.join("、"));
  }

  // ── 實際接觸 ──
  lines.push("");
  lines.push("【實際接觸】");
  lines.push(`・主動推給符合條件的買方：${auto.pitches} 次（系統裡目前有 ${auto.matchedBuyers} 位條件相符）`);
  lines.push(`・實際帶看：${auto.viewingBuyers} 組（共 ${auto.viewings} 次）`);
  if (manual.p591_contacts) lines.push(`・平台來電詢問：${manual.p591_contacts} 組`);
  if (auto.offers > 0) lines.push(`・出價／下斡旋：${auto.offers} 組`);

  // ── 買方怎麼說 ──
  if (auto.reactions.length) {
    lines.push("");
    lines.push("【看過的買方怎麼說】");
    lines.push(auto.reactions.map((r) => `${r.label} ${r.count} 組`).join("、"));
  }
  if (auto.objections.length) {
    lines.push("");
    lines.push("【買方提到的顧慮】（原話）");
    auto.objections.forEach((o) => lines.push(`・${o}`));
  }

  // ── 我們做了什麼 ──
  if (auto.marketingActions.length) {
    lines.push("");
    lines.push("【這段期間做的行銷】");
    auto.marketingActions.forEach((m) => lines.push(`・${fmtDate(m.at)} ${m.content}`));
  }

  // ── 建議 ──
  const suggestion = input.suggestion?.trim() || autoSuggestion(auto, manual);
  if (suggestion) {
    lines.push("");
    lines.push("【我的建議】");
    lines.push(suggestion);
  }

  lines.push("");
  lines.push(`${OWNER.company}　${OWNER.name}　${OWNER.phone}`);
  return lines.join("\n");
}

/**
 * 沒手動寫建議時，用數字推一句出來。
 *
 * 這裡的判斷是房仲的老經驗：**看的人多、出價的人少 = 價格問題；
 * 看的人本來就少 = 曝光或格局問題。** 兩者的處方完全不同，講錯會被屋主看破。
 */
export function autoSuggestion(auto: ReportAuto, manual: ReportManual): string {
  const views = manual.p591_views ?? 0;

  if (auto.offers > 0) {
    return "已經有買方出價了，代表價格帶已經進到市場願意談的範圍。建議這幾天把時間留出來，我們把它談成。";
  }
  if (auto.viewingBuyers >= 3 && auto.offers === 0) {
    const why = auto.objections.length ? "買方提到的顧慮集中在上面那幾點" : "";
    return `已經有 ${auto.viewingBuyers} 組實際到現場看過，但都沒有進到出價。${why}${why ? "，" : ""}通常這代表開價與買方心裡的數字還有一段距離。建議我們約個時間，我把附近三個月的實際成交拿給您對照，一起看看要調整價格，還是先處理屋況。`;
  }
  if (auto.viewingBuyers > 0 && auto.viewingBuyers < 3) {
    return `目前 ${auto.viewingBuyers} 組看過。組數還不夠多到能判斷是價格問題，建議再給兩週衝曝光；同時我會持續把它推給名單裡條件相符的買方。`;
  }
  if (views >= 300 && auto.viewingBuyers === 0) {
    return "網路上看的人不少，但約不出來看屋。這種情況多半是照片或開價在第一關就把人擋掉了。建議我們重拍幾張主要角度的照片，並重新檢視開價。";
  }
  if (views > 0 && views < 100) {
    return "目前曝光量偏低，我這邊會加強社群與平台的推播；下次回報時會把新的數字附上來對照。";
  }
  return "這段期間的資料還不足以下判斷。我會持續推播並記錄每一組買方的反應，下次回報時一起攤開來看。";
}

// ---- 存檔 ----

export async function saveReport(input: {
  sellerId: string;
  listingId: string | null;
  from: Date;
  to: Date;
  auto: ReportAuto;
  manual: ReportManual;
  summary: string;
  suggestion: string | null;
  createdBy?: string | null;
}): Promise<string> {
  await ensureSellerTables();
  const id = newId("srep");
  await db.$executeRawUnsafe(
    `INSERT INTO seller_report
      (id, seller_id, listing_id, period_start, period_end, auto_json, manual_json, summary, suggestion, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.sellerId,
    input.listingId,
    input.from,
    input.to,
    JSON.stringify(input.auto),
    JSON.stringify(input.manual),
    input.summary,
    input.suggestion,
    input.createdBy ?? null,
  );
  return id;
}

export async function markReportSent(id: string, channel: string): Promise<void> {
  await ensureSellerTables();
  await db.$executeRawUnsafe(
    `UPDATE seller_report SET sent_at = NOW(), sent_channel = ? WHERE id = ?`,
    channel,
    id,
  );
}

export async function listReports(sellerId: string, limit = 20): Promise<SellerReportRow[]> {
  await ensureSellerTables();
  return db.$queryRawUnsafe<SellerReportRow[]>(
    `SELECT * FROM seller_report WHERE seller_id = ? ORDER BY period_end DESC LIMIT ?`,
    sellerId,
    limit,
  );
}

export function parseAuto(raw: string | null): ReportAuto | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReportAuto;
  } catch {
    return null;
  }
}

export function parseManual(raw: string | null): ReportManual {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ReportManual;
  } catch {
    return {};
  }
}
