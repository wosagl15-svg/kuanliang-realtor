/**
 * 賣方（屋主）資料庫 — 讀寫與意圖判讀（2026-08-22）
 *
 * 這個檔要回答房仲每天最花時間的三個問題：
 *   ① 這個屋主到底是真的要賣，還是掛著試水溫？
 *   ② 他什麼情況下會鬆口？
 *   ③ 我上次跟他講了什麼，這次要接哪裡講？
 *
 * ③ 靠 seller_contact_log 逐次記；①② 靠 computeIntent() 從那些紀錄算出來。
 * 意圖判讀刻意做成**規則式、可解釋**的：每一分都講得出理由，
 * 業務看得懂才會信，才會願意繼續往裡面填東西。AI 只在使用者按下去時做加值分析，
 * 不當唯一真相 —— 沒有 API 金鑰的環境，整套照樣能用。
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ensureSellerTables } from "@/lib/seller-schema";
import { ensureBuyerTables } from "@/lib/buyer-schema";
import { normalizePhone } from "@/lib/phone";
import {
  motivePressure,
  priceFlexScore,
  sentimentWeight,
  REPORT_DUE_DAYS,
  type SellerStageKey,
} from "@/lib/seller-constants";
import type { ListingRow } from "@/lib/buyer-match";

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export type SellerRow = {
  id: string;
  name: string;
  phone_norm: string;
  phone_raw: string | null;
  line_user_id: string | null;
  email: string | null;
  source: string;
  stage: string;
  motive: string;
  motive_note: string | null;
  price_flex: string;
  ask_price: number | null;
  bottom_price: number | null;
  decision_maker: string | null;
  co_owner_note: string | null;
  deadline_at: Date | null;
  mandate_start: Date | null;
  mandate_end: Date | null;
  mandate_kind: string | null;
  personality_note: string | null;
  intent_score: number;
  intent_label: string;
  last_contact_at: Date | null;
  last_report_at: Date | null;
  appointment_id: string | null;
  is_demo: number;
  created_at: Date;
  updated_at: Date | null;
};

export type SellerContactRow = {
  id: string;
  seller_id: string;
  listing_id: string | null;
  type: string;
  content: string | null;
  sentiment: string | null;
  price_mentioned: number | null;
  appointment_id: string | null;
  occurred_at: Date;
  created_by: string | null;
  created_at: Date;
};

export type SellerInput = {
  name: string;
  phone?: string | null;
  lineUserId?: string | null;
  email?: string | null;
  source?: string;
  stage?: SellerStageKey;
  motive?: string;
  motiveNote?: string | null;
  priceFlex?: string;
  askPrice?: number | null;
  bottomPrice?: number | null;
  decisionMaker?: string | null;
  coOwnerNote?: string | null;
  deadlineAt?: string | null;
  mandateStart?: string | null;
  mandateEnd?: string | null;
  mandateKind?: string | null;
  personalityNote?: string | null;
  appointmentId?: string | null;
};

// ---- 撞號檢查：同一個屋主被建兩次，兩邊各記一半歷程，比沒建還糟 ----

export async function findSellerByPhone(phoneRaw: string): Promise<{ id: string; name: string } | null> {
  await ensureSellerTables();
  const norm = normalizePhone(phoneRaw);
  if (!norm) return null;
  const rows = await db.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM seller WHERE phone_norm = ? LIMIT 1`,
    norm,
  );
  return rows[0] ?? null;
}

export async function createSeller(input: SellerInput): Promise<string> {
  await ensureSellerTables();
  const id = newId("slr");
  const norm = normalizePhone(input.phone ?? "") ?? "";
  await db.$executeRawUnsafe(
    `INSERT INTO seller
      (id, name, phone_norm, phone_raw, line_user_id, email, source, stage, motive, motive_note,
       price_flex, ask_price, bottom_price, decision_maker, co_owner_note, deadline_at,
       mandate_start, mandate_end, mandate_kind, personality_note, appointment_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.name.trim().slice(0, 80),
    norm,
    input.phone ?? null,
    input.lineUserId ?? null,
    input.email ?? null,
    input.source ?? "manual",
    input.stage ?? "lead",
    input.motive ?? "unknown",
    input.motiveNote ?? null,
    input.priceFlex ?? "unknown",
    input.askPrice ?? null,
    input.bottomPrice ?? null,
    input.decisionMaker ?? null,
    input.coOwnerNote ?? null,
    input.deadlineAt || null,
    input.mandateStart || null,
    input.mandateEnd || null,
    input.mandateKind ?? null,
    input.personalityNote ?? null,
    input.appointmentId ?? null,
  );
  await recomputeSeller(id);
  return id;
}

export async function updateSeller(id: string, input: Partial<SellerInput>): Promise<void> {
  await ensureSellerTables();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const put = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(val);
  };

  if (input.name !== undefined) put("name", input.name.trim().slice(0, 80));
  if (input.phone !== undefined) {
    put("phone_norm", normalizePhone(input.phone ?? "") ?? "");
    put("phone_raw", input.phone ?? null);
  }
  if (input.lineUserId !== undefined) put("line_user_id", input.lineUserId);
  if (input.email !== undefined) put("email", input.email);
  if (input.stage !== undefined) put("stage", input.stage);
  if (input.motive !== undefined) put("motive", input.motive);
  if (input.motiveNote !== undefined) put("motive_note", input.motiveNote);
  if (input.priceFlex !== undefined) put("price_flex", input.priceFlex);
  if (input.askPrice !== undefined) put("ask_price", input.askPrice);
  if (input.bottomPrice !== undefined) put("bottom_price", input.bottomPrice);
  if (input.decisionMaker !== undefined) put("decision_maker", input.decisionMaker);
  if (input.coOwnerNote !== undefined) put("co_owner_note", input.coOwnerNote);
  if (input.deadlineAt !== undefined) put("deadline_at", input.deadlineAt || null);
  if (input.mandateStart !== undefined) put("mandate_start", input.mandateStart || null);
  if (input.mandateEnd !== undefined) put("mandate_end", input.mandateEnd || null);
  if (input.mandateKind !== undefined) put("mandate_kind", input.mandateKind);
  if (input.personalityNote !== undefined) put("personality_note", input.personalityNote);

  if (!sets.length) return;
  vals.push(id);
  await db.$executeRawUnsafe(`UPDATE seller SET ${sets.join(", ")} WHERE id = ?`, ...vals);
  await recomputeSeller(id);
}

export async function getSeller(id: string): Promise<SellerRow | null> {
  await ensureSellerTables();
  const rows = await db.$queryRawUnsafe<SellerRow[]>(`SELECT * FROM seller WHERE id = ? LIMIT 1`, id);
  return rows[0] ?? null;
}

// ---- 聯絡歷程 ----

/**
 * 每次聯絡就記一筆。**這是整套系統唯一真正要求業務做的事。**
 *
 * 刻意做得很輕（打一句話 + 選態度就能存），因為只要超過三十秒，
 * 現場剛掛掉電話的房仲就不會填 —— 不填，後面的意圖分析與回報表就全是空的。
 */
export async function addSellerContact(input: {
  sellerId: string;
  type: string;
  content?: string | null;
  sentiment?: string | null;
  priceMentioned?: number | null;
  listingId?: string | null;
  appointmentId?: string | null;
  occurredAt?: Date;
  createdBy?: string | null;
}): Promise<string> {
  await ensureSellerTables();
  const id = newId("scl");
  const at = input.occurredAt ?? new Date();
  await db.$executeRawUnsafe(
    `INSERT INTO seller_contact_log
      (id, seller_id, listing_id, type, content, sentiment, price_mentioned, appointment_id, occurred_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.sellerId,
    input.listingId ?? null,
    input.type,
    input.content ?? null,
    input.sentiment ?? null,
    input.priceMentioned ?? null,
    input.appointmentId ?? null,
    at,
    input.createdBy ?? null,
  );

  await db.$executeRawUnsafe(
    `UPDATE seller SET last_contact_at = GREATEST(COALESCE(last_contact_at, ?), ?) WHERE id = ?`,
    at,
    at,
    input.sellerId,
  );
  // 「回報」是唯一會重設回報時鐘的類型。通話、帶看回饋都不算 ——
  // 屋主要的是「你主動告訴我進度」，不是「我打去你才講」。
  if (input.type === "report") {
    await db.$executeRawUnsafe(
      `UPDATE seller SET last_report_at = GREATEST(COALESCE(last_report_at, ?), ?) WHERE id = ?`,
      at,
      at,
      input.sellerId,
    );
  }
  // 屋主在這次談話裡講了新的數字 → 開價跟著更新，鬆動曲線才畫得出來
  if (typeof input.priceMentioned === "number" && input.priceMentioned > 0) {
    await db.$executeRawUnsafe(`UPDATE seller SET ask_price = ? WHERE id = ?`, input.priceMentioned, input.sellerId);
  }

  await recomputeSeller(input.sellerId);
  return id;
}

export async function listSellerContacts(sellerId: string, limit = 200): Promise<SellerContactRow[]> {
  await ensureSellerTables();
  return db.$queryRawUnsafe<SellerContactRow[]>(
    `SELECT * FROM seller_contact_log WHERE seller_id = ? ORDER BY occurred_at DESC LIMIT ?`,
    sellerId,
    limit,
  );
}

export async function deleteSellerContact(id: string, sellerId: string): Promise<void> {
  await ensureSellerTables();
  await db.$executeRawUnsafe(`DELETE FROM seller_contact_log WHERE id = ? AND seller_id = ?`, id, sellerId);
  await recomputeSeller(sellerId);
}

// ---- 意圖判讀 ----

export type IntentFactor = {
  label: string;
  /** 這一項貢獻了幾分（可為負） */
  points: number;
  /** 為什麼給這個分數 —— 沒有理由的分數沒人會信 */
  why: string;
};

export type SellerIntent = {
  score: number;
  /** hot=真的要賣、warm=有機會但要推、cold=試水溫、unknown=資料不夠 */
  label: "hot" | "warm" | "cold" | "unknown";
  headline: string;
  factors: IntentFactor[];
  /** 現在該做什麼 */
  nextActions: string[];
  /** 資料不夠時，缺的是哪幾題 */
  missing: string[];
};

/**
 * 意圖分數 = 動機壓力 + 價格彈性 + 行為軸（歷次態度）+ 時間壓力 − 阻力。
 *
 * 為什麼不用 AI 算這個分數：
 *   分數要每天看、要拿來排序、要能被質疑（「憑什麼說他只是試水溫」）。
 *   規則式的每一分都指得出是哪一句話造成的；AI 給的分數今天 7 分明天 5 分，
 *   業務問「為什麼變了」你答不出來，這個功能就死了。
 *   AI 的位置是「讀完歷程寫一段人話」，那才是它真正比規則強的地方。
 */
export function computeIntent(seller: SellerRow, logs: SellerContactRow[]): SellerIntent {
  const factors: IntentFactor[] = [];
  const missing: string[] = [];
  const nextActions: string[] = [];

  // ① 動機壓力（0–5）
  const pressure = motivePressure(seller.motive);
  if (seller.motive === "unknown") {
    missing.push("為什麼要賣（動機）");
  } else {
    factors.push({
      label: "賣的動機",
      points: pressure,
      why:
        pressure >= 4
          ? "有明確的資金或期限壓力，時間站在你這邊"
          : pressure >= 2
            ? "有理由要賣，但不見得急"
            : "沒有非賣不可的理由，價格談不下來很正常",
    });
  }

  // ② 價格彈性（0–5）
  const flex = priceFlexScore(seller.price_flex);
  if (seller.price_flex === "unknown") {
    missing.push("價格能不能談");
  } else {
    factors.push({
      label: "價格彈性",
      points: flex,
      why: flex >= 4 ? "屋主自己說了價格好談" : flex >= 2 ? "留了一點空間" : "目前咬死不讓",
    });
  }

  // ③ 行為軸：歷次態度加總（最近的權重高，人是會變的）
  const sentimented = logs.filter((l) => l.sentiment);
  let behaviour = 0;
  sentimented.slice(0, 8).forEach((l, i) => {
    // 最近三次算滿分，再往前折半 —— 半年前的態度不能拿來當今天的判斷
    behaviour += sentimentWeight(l.sentiment) * (i < 3 ? 1 : 0.5);
  });
  behaviour = Math.round(behaviour);
  if (sentimented.length === 0) {
    missing.push("聯絡後的態度（每次記一下就好）");
  } else {
    factors.push({
      label: `歷次態度（${sentimented.length} 次）`,
      points: behaviour,
      why:
        behaviour >= 2
          ? "談過幾次之後態度往好的方向走，這是最可信的訊號"
          : behaviour <= -2
            ? "連續幾次都很堅持或有情緒，硬推只會把關係談壞"
            : "態度平穩，還沒出現明顯轉折",
    });
  }

  // ④ 開價鬆動：實際降過價，比說一百句「可以談」都準
  const priced = logs
    .filter((l) => typeof l.price_mentioned === "number" && (l.price_mentioned as number) > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  if (priced.length >= 2) {
    const first = priced[0].price_mentioned as number;
    const last = priced[priced.length - 1].price_mentioned as number;
    const dropPct = ((first - last) / first) * 100;
    if (dropPct >= 1) {
      factors.push({
        label: "開價已經鬆動",
        points: dropPct >= 5 ? 4 : 2,
        why: `從 ${first} 萬降到 ${last} 萬（${dropPct.toFixed(1)}%）—— 會降第一次就會有第二次`,
      });
    } else if (dropPct <= -1) {
      factors.push({
        label: "開價往上調",
        points: -3,
        why: `從 ${first} 萬變成 ${last} 萬。屋主的預期在變高，通常是聽到鄰居賣多少`,
      });
    }
  }

  // ⑤ 時間壓力：自己講的期限
  if (seller.deadline_at) {
    const days = Math.ceil((new Date(seller.deadline_at).getTime() - Date.now()) / 86400_000);
    if (days <= 30 && days > -365) {
      factors.push({
        label: "期限快到了",
        points: days <= 0 ? 4 : days <= 14 ? 3 : 2,
        why: days <= 0 ? "期限已經過了，現在是最好談的時候" : `距離他說的期限剩 ${days} 天`,
      });
    }
  }

  // ⑥ 阻力：共有人／決策者不明
  if (!seller.decision_maker) {
    missing.push("誰能點頭（決策者）");
  }
  if (seller.co_owner_note) {
    factors.push({
      label: "有共有人",
      points: -2,
      why: "多一個人點頭就多一次翻案的機會。談之前先確認全部人的共識",
    });
  }

  // ⑦ 委託階段本身
  if (seller.stage === "negotiating") {
    factors.push({ label: "議價中", points: 4, why: "桌上有斡旋，這是離成交最近的一刻" });
  } else if (seller.stage === "listed") {
    factors.push({ label: "已簽委託", points: 2, why: "願意簽字就是願意賣的最低門檻" });
  } else if (seller.stage === "lead") {
    factors.push({ label: "還沒簽委託", points: -1, why: "沒有委託書，前面所有努力都可能被別家收走" });
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0);

  // 資料太少就不要裝懂 —— 給一個假的判讀比不給還糟
  const enough = factors.length >= 3;
  const label: SellerIntent["label"] = !enough
    ? "unknown"
    : score >= 9
      ? "hot"
      : score >= 4
        ? "warm"
        : "cold";

  const headline =
    label === "hot"
      ? "真的要賣，而且談得動 —— 現在推最有機會"
      : label === "warm"
        ? "有機會，但要有東西推他一把（帶看回饋、成交行情）"
        : label === "cold"
          ? "目前比較像掛著試水溫，不要把時間全押在這裡"
          : "資料還不夠判斷，先把下面幾題問出來";

  // 下一步建議
  if (label === "hot") {
    nextActions.push("趁熱把買方拉進來看，出價機會就在這幾天");
    if (seller.stage === "lead") nextActions.push("先簽委託再帶看 —— 現在不簽，帶看完別家會來收割");
  }
  if (label === "warm") {
    nextActions.push("做一份屋主回報：帶看幾組、買方嫌什麼，用事實推價格");
    nextActions.push("拿附近三個月的實際成交去對照他的開價");
  }
  if (label === "cold") {
    nextActions.push("降低投入：改成每兩週一通維繫，不要再花時間排帶看");
    nextActions.push("留一句話給他：「有想認真賣的時候第一個找我」");
  }
  if (seller.stage === "listed" && isReportOverdue(seller)) {
    nextActions.unshift(`已經 ${daysSinceReport(seller) ?? "很多"} 天沒回報了 —— 今天先回報再談別的`);
  }

  return { score, label, headline, factors, nextActions, missing };
}

/** 重算並寫回主檔（列表頁要用它排序） */
export async function recomputeSeller(sellerId: string): Promise<void> {
  await ensureSellerTables();
  const seller = await getSeller(sellerId);
  if (!seller) return;
  const logs = await listSellerContacts(sellerId, 100);
  const intent = computeIntent(seller, logs);
  await db.$executeRawUnsafe(
    `UPDATE seller SET intent_score = ?, intent_label = ? WHERE id = ?`,
    intent.score,
    intent.label,
    sellerId,
  );
}

// ---- 回報時鐘 ----

export function daysSinceReport(seller: Pick<SellerRow, "last_report_at" | "created_at">): number | null {
  const base = seller.last_report_at ?? seller.created_at;
  if (!base) return null;
  return Math.floor((Date.now() - new Date(base).getTime()) / 86400_000);
}

/** 委託銷售中 / 議價中 的屋主，超過 REPORT_DUE_DAYS 天沒回報就是失職 */
export function isReportOverdue(seller: Pick<SellerRow, "stage" | "last_report_at" | "created_at">): boolean {
  if (!["listed", "negotiating"].includes(seller.stage)) return false;
  const d = daysSinceReport(seller);
  return d !== null && d >= REPORT_DUE_DAYS;
}

// ---- 列表 ----

export type SellerFilter = {
  q?: string;
  stage?: string;
  intent?: string;
  /** 只看該回報的 */
  reportDue?: boolean;
  limit?: number;
};

export async function listSellers(f: SellerFilter = {}): Promise<{ rows: SellerRow[]; total: number }> {
  await ensureSellerTables();
  const where: string[] = ["1=1"];
  const vals: unknown[] = [];

  if (f.q) {
    where.push("(name LIKE ? OR phone_norm LIKE ? OR email LIKE ?)");
    const p = `%${f.q.replace(/[%_]/g, "\\$&")}%`;
    vals.push(p, p, p);
  }
  if (f.stage && f.stage !== "all") {
    where.push("stage = ?");
    vals.push(f.stage);
  }
  if (f.intent && f.intent !== "all") {
    where.push("intent_label = ?");
    vals.push(f.intent);
  }
  if (f.reportDue) {
    where.push("stage IN ('listed','negotiating')");
    where.push(`COALESCE(last_report_at, created_at) <= DATE_SUB(NOW(), INTERVAL ${REPORT_DUE_DAYS} DAY)`);
  }

  const clause = where.join(" AND ");
  const countRows = await db.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM seller WHERE ${clause}`,
    ...vals,
  );
  const rows = await db.$queryRawUnsafe<SellerRow[]>(
    `SELECT * FROM seller WHERE ${clause}
      ORDER BY
        CASE stage WHEN 'negotiating' THEN 0 WHEN 'listed' THEN 1 WHEN 'lead' THEN 2 ELSE 3 END,
        intent_score DESC,
        COALESCE(last_report_at, created_at) ASC
      LIMIT ?`,
    ...vals,
    Math.min(f.limit ?? 200, 500),
  );
  return { rows, total: Number(countRows[0]?.n ?? 0) };
}

/** 該回報的屋主（每日工作台要用） */
export async function listReportDueSellers(limit = 20): Promise<SellerRow[]> {
  const { rows } = await listSellers({ reportDue: true, limit });
  return rows;
}

// ---- 賣方 ↔ 物件 ----

export async function listSellerListings(sellerId: string): Promise<ListingRow[]> {
  await ensureSellerTables();
  await ensureBuyerTables();
  return db.$queryRawUnsafe<ListingRow[]>(
    `SELECT * FROM listing WHERE seller_id = ? ORDER BY created_at DESC LIMIT 50`,
    sellerId,
  );
}

export async function attachListingToSeller(listingId: string, sellerId: string): Promise<void> {
  await ensureSellerTables();
  await db.$executeRawUnsafe(`UPDATE listing SET seller_id = ? WHERE id = ?`, sellerId, listingId);
}

/** 還沒認領屋主的物件（詳情頁要讓人一鍵掛上） */
export async function listUnclaimedListings(limit = 50): Promise<ListingRow[]> {
  await ensureSellerTables();
  await ensureBuyerTables();
  return db.$queryRawUnsafe<ListingRow[]>(
    `SELECT * FROM listing WHERE seller_id IS NULL ORDER BY created_at DESC LIMIT ?`,
    limit,
  );
}

export async function sellerStats(): Promise<{
  total: number;
  listed: number;
  negotiating: number;
  reportDue: number;
}> {
  await ensureSellerTables();
  const rows = await db.$queryRawUnsafe<Array<{ stage: string; n: bigint | number }>>(
    `SELECT stage, COUNT(*) AS n FROM seller GROUP BY stage`,
  );
  const by = new Map(rows.map((r) => [r.stage, Number(r.n)]));
  const dueRows = await db.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*) AS n FROM seller
      WHERE stage IN ('listed','negotiating')
        AND COALESCE(last_report_at, created_at) <= DATE_SUB(NOW(), INTERVAL ${REPORT_DUE_DAYS} DAY)`,
  );
  return {
    total: [...by.values()].reduce((a, b) => a + b, 0),
    listed: by.get("listed") ?? 0,
    negotiating: by.get("negotiating") ?? 0,
    reportDue: Number(dueRows[0]?.n ?? 0),
  };
}
