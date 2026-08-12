/**
 * 買方資料庫 — 資料層（2026-08-12）
 *
 * raw SQL 讀寫，沿用 appointment.ts 的做法（不依賴 prisma client 重生）。
 * 純常數 / 型別在 buyer-constants.ts，計分在 buyer-completeness.ts，兩者 client 端也能 import。
 *
 * 🚨 全 additive：新表，不改任何既有表 / 邏輯。
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ensureBuyerTables } from "@/lib/buyer-schema";
import { normalizePhone } from "@/lib/phone";
import {
  DORMANT_DAYS,
  REQUIREMENT_STALE_DAYS,
  type ExtractionMeta,
  type PropertyTypeKey,
  type StageKey,
} from "@/lib/buyer-constants";
import {
  computeCompleteness,
  computeHeat,
  priorityOf,
  type CompletenessResult,
  type HeatResult,
} from "@/lib/buyer-completeness";

/** 建檔時撞到既有電話 → route 捕捉回 409，前端跳「這支電話已經是 X 的客戶」 */
export class BuyerPhoneConflictError extends Error {
  existingId: string;
  existingName: string;
  constructor(existingId: string, existingName: string) {
    super("buyer_phone_conflict");
    this.name = "BuyerPhoneConflictError";
    this.existingId = existingId;
    this.existingName = existingName;
  }
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---- 型別 ----

export type BuyerListItem = {
  id: string;
  name: string;
  phone_norm: string;
  stage: StageKey;
  source: string;
  grade: string;
  completeness_pct: number;
  heat_score: number;
  broadcast_opt_out: number;
  last_contact_at: Date | null;
  created_at: Date;
  // 人的資訊（算「缺哪幾欄」要用）
  decision_maker: string | null;
  urgency: string | null;
  funding_note: string | null;
  // 當前需求（來自 buyer_requirement is_current=1）
  budget_min: number | null;
  budget_max: number | null;
  districts: string | null;
  room_min: number | null;
  elevator: string | null;
  parking: string | null;
  purpose: string | null;
  size_min: number | null;
  age_max: number | null;
  req_created_at: Date | null;
  /** 標籤數量（完整度計分要用，避免 N+1 撈標籤名稱） */
  tag_count: number;
};

export type BuyerDetail = {
  buyer: Record<string, unknown>;
  requirement: Record<string, unknown> | null;
  requirementHistory: Array<Record<string, unknown>>;
  tags: Array<{ id: string; name: string; category: string }>;
  communities: Array<{ id: string; name: string; district: string }>;
  contacts: Array<Record<string, unknown>>;
  completeness: CompletenessResult;
  heat: HeatResult;
  priority: ReturnType<typeof priorityOf>;
  /** 需求超過 90 天沒更新 → 配對時要降權，介面要標「需求待確認」 */
  requirementStale: boolean;
  daysSinceContact: number | null;
};

// ---- 撞號檢查 ----

export async function findBuyerByPhone(phoneRaw: string): Promise<{ id: string; name: string } | null> {
  await ensureBuyerTables();
  const norm = normalizePhone(phoneRaw);
  if (!norm) return null;
  const rows = await db.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, name FROM buyer WHERE phone_norm = ? LIMIT 1`,
    norm,
  );
  return rows[0] ?? null;
}

// ---- 建檔 / 更新 ----

export type BuyerInput = {
  name: string;
  phoneRaw?: string | null;
  lineUserId?: string | null;
  email?: string | null;
  source?: string;
  stage?: StageKey;
  propertyType?: PropertyTypeKey;
  ownerEmail?: string | null;
  personalityNote?: string | null;
  decisionMaker?: string | null;
  fundingNote?: string | null;
  urgency?: string | null;
};

export async function createBuyer(input: BuyerInput): Promise<string> {
  await ensureBuyerTables();
  const norm = normalizePhone(input.phoneRaw ?? null);

  if (norm) {
    const dup = await findBuyerByPhone(norm);
    if (dup) throw new BuyerPhoneConflictError(dup.id, dup.name);
  }

  const id = newId("byr");
  await db.$executeRawUnsafe(
    `INSERT INTO buyer
      (id, name, phone_norm, phone_raw, line_user_id, email, source, stage, property_type,
       owner_email, personality_note, decision_maker, funding_note, urgency)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.name.trim() || "（未留姓名）",
    norm ?? "",
    input.phoneRaw ?? null,
    input.lineUserId ?? null,
    input.email ?? null,
    input.source ?? "manual",
    input.stage ?? "new",
    input.propertyType ?? "house",
    input.ownerEmail ?? null,
    input.personalityNote ?? null,
    input.decisionMaker ?? null,
    input.fundingNote ?? null,
    input.urgency ?? null,
  );
  return id;
}

export async function updateBuyer(id: string, input: Partial<BuyerInput>): Promise<void> {
  await ensureBuyerTables();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const push = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };

  if (input.name !== undefined) push("name", input.name.trim());
  if (input.phoneRaw !== undefined) {
    const norm = normalizePhone(input.phoneRaw);
    if (norm) {
      const dup = await findBuyerByPhone(norm);
      if (dup && dup.id !== id) throw new BuyerPhoneConflictError(dup.id, dup.name);
    }
    push("phone_norm", norm ?? "");
    push("phone_raw", input.phoneRaw);
  }
  if (input.lineUserId !== undefined) push("line_user_id", input.lineUserId);
  if (input.email !== undefined) push("email", input.email);
  if (input.stage !== undefined) push("stage", input.stage);
  if (input.source !== undefined) push("source", input.source);
  if (input.ownerEmail !== undefined) push("owner_email", input.ownerEmail);
  if (input.personalityNote !== undefined) push("personality_note", input.personalityNote);
  if (input.decisionMaker !== undefined) push("decision_maker", input.decisionMaker);
  if (input.fundingNote !== undefined) push("funding_note", input.fundingNote);
  if (input.urgency !== undefined) push("urgency", input.urgency);

  if (!sets.length) return;
  vals.push(id);
  await db.$executeRawUnsafe(`UPDATE buyer SET ${sets.join(", ")} WHERE id = ?`, ...vals);
  await recomputeBuyer(id);
}

export async function setBroadcastOptOut(id: string, optOut: boolean): Promise<void> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(`UPDATE buyer SET broadcast_opt_out = ? WHERE id = ?`, optOut ? 1 : 0, id);
}

// ---- 需求版本 ----

export type RequirementInput = {
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetFlexPct?: number;
  districts?: string[];
  roomMin?: number | null;
  elevator?: string;
  parking?: string;
  purpose?: string;
  sizeMin?: number | null;
  sizeMax?: number | null;
  ageMax?: number | null;
  floorPref?: string | null;
  soft?: Record<string, unknown> | null;
  rawSourceText?: string | null;
  extractionMeta?: ExtractionMeta | null;
  createdBy?: string | null;
};

/**
 * 存一版新需求，舊版自動退居歷史。
 * 🔴 絕不 UPDATE 舊版 —— 需求歷程是判斷「他到底在找什麼」的關鍵證據。
 */
export async function saveRequirement(buyerId: string, input: RequirementInput): Promise<string> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(
    `UPDATE buyer_requirement SET is_current = 0 WHERE buyer_id = ? AND is_current = 1`,
    buyerId,
  );

  const id = newId("breq");
  await db.$executeRawUnsafe(
    `INSERT INTO buyer_requirement
      (id, buyer_id, is_current, budget_min, budget_max, budget_flex_pct, districts, room_min,
       elevator, parking, purpose, size_min, size_max, age_max, floor_pref, soft_json,
       raw_source_text, extraction_meta, created_by)
     VALUES (?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    buyerId,
    input.budgetMin ?? null,
    input.budgetMax ?? null,
    input.budgetFlexPct ?? 0,
    JSON.stringify(input.districts ?? []),
    input.roomMin ?? null,
    input.elevator ?? "any",
    input.parking ?? "any",
    input.purpose ?? "unknown",
    input.sizeMin ?? null,
    input.sizeMax ?? null,
    input.ageMax ?? null,
    input.floorPref ?? null,
    input.soft ? JSON.stringify(input.soft) : null,
    input.rawSourceText ?? null,
    input.extractionMeta ? JSON.stringify(input.extractionMeta) : null,
    input.createdBy ?? null,
  );

  await recomputeBuyer(buyerId);
  return id;
}

// ---- 標籤 ----

export async function listTagDefs(): Promise<Array<{ id: string; name: string; category: string; is_controlled: number; use_count: number }>> {
  await ensureBuyerTables();
  return db.$queryRawUnsafe(
    `SELECT id, name, category, is_controlled, use_count FROM buyer_tag_def ORDER BY category, name LIMIT 500`,
  );
}

export async function setBuyerTags(buyerId: string, tagIds: string[]): Promise<void> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(`DELETE FROM buyer_tag WHERE buyer_id = ?`, buyerId);
  for (const t of [...new Set(tagIds)]) {
    await db.$executeRawUnsafe(
      `INSERT IGNORE INTO buyer_tag (buyer_id, tag_id) VALUES (?, ?)`,
      buyerId,
      t,
    );
  }
  await db.$executeRawUnsafe(
    `UPDATE buyer_tag_def d SET use_count = (SELECT COUNT(*) FROM buyer_tag t WHERE t.tag_id = d.id)`,
  );
  await recomputeBuyer(buyerId);
}

/** 新增自由標籤（不參與配對）。要升級成受控標籤需人工審 —— 沒這道關卡，半年後標籤就爛了。 */
export async function createFreeTag(name: string, category = "special"): Promise<string> {
  await ensureBuyerTables();
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error("tag_name_required");
  const existing = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM buyer_tag_def WHERE name = ? LIMIT 1`,
    clean,
  );
  if (existing[0]) return existing[0].id;
  const id = newId("tag");
  await db.$executeRawUnsafe(
    `INSERT INTO buyer_tag_def (id, name, category, is_controlled) VALUES (?,?,?,0)`,
    id,
    clean,
    category,
  );
  return id;
}

// ---- 指定社區 ----

export async function setBuyerCommunities(buyerId: string, communityIds: string[]): Promise<void> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(`DELETE FROM buyer_community WHERE buyer_id = ?`, buyerId);
  for (const c of [...new Set(communityIds)]) {
    await db.$executeRawUnsafe(
      `INSERT IGNORE INTO buyer_community (buyer_id, community_id) VALUES (?, ?)`,
      buyerId,
      c,
    );
  }
}

// ---- 互動紀錄 ----

export async function addContactLog(input: {
  buyerId: string;
  type: string;
  content?: string | null;
  communityId?: string | null;
  listingId?: string | null;
  reaction?: string | null;
  occurredAt?: Date;
  createdBy?: string | null;
}): Promise<string> {
  await ensureBuyerTables();
  const id = newId("blog");
  const at = input.occurredAt ?? new Date();
  await db.$executeRawUnsafe(
    `INSERT INTO buyer_contact_log
      (id, buyer_id, type, content, community_id, listing_id, reaction, occurred_at, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id,
    input.buyerId,
    input.type,
    input.content ?? null,
    input.communityId ?? null,
    input.listingId ?? null,
    input.reaction ?? null,
    at,
    input.createdBy ?? null,
  );
  await db.$executeRawUnsafe(
    `UPDATE buyer SET last_contact_at = GREATEST(COALESCE(last_contact_at, ?), ?) WHERE id = ?`,
    at,
    at,
    input.buyerId,
  );
  await recomputeBuyer(input.buyerId);
  return id;
}

// ---- 重算完整度 / 熱度 / 分級 ----

export async function recomputeBuyer(buyerId: string): Promise<void> {
  await ensureBuyerTables();
  const b = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM buyer WHERE id = ? LIMIT 1`,
    buyerId,
  );
  if (!b[0]) return;
  const buyer = b[0];

  const req = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM buyer_requirement WHERE buyer_id = ? AND is_current = 1 LIMIT 1`,
    buyerId,
  );
  const r = req[0] ?? {};

  const tags = await db.$queryRawUnsafe<{ name: string }[]>(
    `SELECT d.name FROM buyer_tag t JOIN buyer_tag_def d ON d.id = t.tag_id WHERE t.buyer_id = ?`,
    buyerId,
  );

  const completeness = computeCompleteness({
    name: buyer.name as string,
    phone_norm: buyer.phone_norm as string,
    budget_max: (r.budget_max as number) ?? null,
    districts: parseJsonArray(r.districts as string),
    room_min: (r.room_min as number) ?? null,
    parking: (r.parking as string) ?? null,
    elevator: (r.elevator as string) ?? null,
    purpose: (r.purpose as string) ?? null,
    size_min: (r.size_min as number) ?? null,
    age_max: (r.age_max as number) ?? null,
    tags: tags.map((t) => t.name),
    decision_maker: (buyer.decision_maker as string) ?? null,
    urgency: (buyer.urgency as string) ?? null,
    funding_note: (buyer.funding_note as string) ?? null,
  });

  const heat = await computeHeatFor(buyerId, buyer.last_contact_at as Date | null);

  await db.$executeRawUnsafe(
    `UPDATE buyer SET completeness_pct = ?, grade = ?, heat_score = ? WHERE id = ?`,
    completeness.pct,
    completeness.grade,
    heat.score,
    buyerId,
  );
}

async function computeHeatFor(buyerId: string, lastContactAt: Date | null): Promise<HeatResult> {
  const since = new Date(Date.now() - 90 * 86400_000);
  const agg = await db.$queryRawUnsafe<{ recent: bigint | number; viewings: bigint | number }[]>(
    `SELECT
       SUM(CASE WHEN occurred_at >= ? AND type IN ('call','line','meet','viewing') THEN 1 ELSE 0 END) AS recent,
       SUM(CASE WHEN type = 'viewing' THEN 1 ELSE 0 END) AS viewings
     FROM buyer_contact_log WHERE buyer_id = ?`,
    since,
    buyerId,
  );

  const push = await db.$queryRawUnsafe<{ pushes: bigint | number; clicks: bigint | number }[]>(
    `SELECT COUNT(*) AS pushes, SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS clicks
       FROM buyer_broadcast_target WHERE buyer_id = ? AND sent_at IS NOT NULL`,
    buyerId,
  );

  const daysSince = lastContactAt
    ? Math.floor((Date.now() - new Date(lastContactAt).getTime()) / 86400_000)
    : null;

  return computeHeat({
    recentContacts: Number(agg[0]?.recent ?? 0),
    viewings: Number(agg[0]?.viewings ?? 0),
    pushes: Number(push[0]?.pushes ?? 0),
    clicks: Number(push[0]?.clicks ?? 0),
    daysSinceContact: daysSince,
  });
}

// ---- 讀取 ----

export async function getBuyerDetail(id: string): Promise<BuyerDetail | null> {
  await ensureBuyerTables();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM buyer WHERE id = ? LIMIT 1`,
    id,
  );
  if (!rows[0]) return null;
  const buyer = rows[0];

  const reqs = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM buyer_requirement WHERE buyer_id = ? ORDER BY created_at DESC LIMIT 50`,
    id,
  );
  const current = reqs.find((r) => Number(r.is_current) === 1) ?? null;

  const tags = await db.$queryRawUnsafe<Array<{ id: string; name: string; category: string }>>(
    `SELECT d.id, d.name, d.category FROM buyer_tag t
       JOIN buyer_tag_def d ON d.id = t.tag_id
      WHERE t.buyer_id = ? ORDER BY d.category, d.name`,
    id,
  );

  const communities = await db.$queryRawUnsafe<Array<{ id: string; name: string; district: string }>>(
    `SELECT c.id, c.name, c.district FROM buyer_community bc
       JOIN community c ON c.id = bc.community_id
      WHERE bc.buyer_id = ? ORDER BY c.name`,
    id,
  );

  const contacts = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM buyer_contact_log WHERE buyer_id = ? ORDER BY occurred_at DESC LIMIT 100`,
    id,
  );

  const completeness = computeCompleteness({
    name: buyer.name as string,
    phone_norm: buyer.phone_norm as string,
    budget_max: (current?.budget_max as number) ?? null,
    districts: parseJsonArray(current?.districts as string),
    room_min: (current?.room_min as number) ?? null,
    parking: (current?.parking as string) ?? null,
    elevator: (current?.elevator as string) ?? null,
    purpose: (current?.purpose as string) ?? null,
    size_min: (current?.size_min as number) ?? null,
    age_max: (current?.age_max as number) ?? null,
    tags: tags.map((t) => t.name),
    decision_maker: (buyer.decision_maker as string) ?? null,
    urgency: (buyer.urgency as string) ?? null,
    funding_note: (buyer.funding_note as string) ?? null,
  });

  const lastContactAt = (buyer.last_contact_at as Date | null) ?? null;
  const heat = await computeHeatFor(id, lastContactAt);
  const daysSinceContact = lastContactAt
    ? Math.floor((Date.now() - new Date(lastContactAt).getTime()) / 86400_000)
    : null;

  const reqAge = current?.created_at
    ? Math.floor((Date.now() - new Date(current.created_at as Date).getTime()) / 86400_000)
    : null;

  return {
    buyer,
    requirement: current,
    requirementHistory: reqs.filter((r) => Number(r.is_current) !== 1),
    tags,
    communities,
    contacts,
    completeness,
    heat,
    priority: priorityOf(completeness, heat),
    requirementStale: reqAge !== null && reqAge > REQUIREMENT_STALE_DAYS,
    daysSinceContact,
  };
}

// ---- 篩選（這是「篩選 × 串聯」的篩選那半）----

export type BuyerFilter = {
  /** 姓名 / 電話 / 社區名（含別名，由呼叫端先轉成 communityId 更準） */
  q?: string;
  districts?: string[];
  communityId?: string;
  /** 物件總價（萬）。會比對「買方預算上限 × (1+彈性%) >= 物件價」 */
  listingPrice?: number;
  budgetMin?: number;
  budgetMax?: number;
  roomMin?: number;
  parking?: string;
  elevator?: string;
  tagIds?: string[];
  grades?: string[];
  stages?: string[];
  /** 只看超過 N 天沒接觸的（沉睡名單） */
  dormantOverDays?: number;
  /** 排除已退出推播的 */
  excludeOptOut?: boolean;
  /** 排除近 N 天已推播過的（推播護欄） */
  excludePushedWithinDays?: number;
  orderBy?: "heat" | "completeness" | "recent" | "created";
  limit?: number;
  offset?: number;
};

export async function listBuyers(f: BuyerFilter = {}): Promise<{ rows: BuyerListItem[]; total: number }> {
  await ensureBuyerTables();

  const where: string[] = ["1=1"];
  const vals: unknown[] = [];

  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`;
    where.push(`(b.name LIKE ? OR b.phone_norm LIKE ? OR b.phone_raw LIKE ?)`);
    vals.push(like, like, like);
  }

  if (f.stages?.length) {
    where.push(`b.stage IN (${f.stages.map(() => "?").join(",")})`);
    vals.push(...f.stages);
  }

  if (f.grades?.length) {
    where.push(`b.grade IN (${f.grades.map(() => "?").join(",")})`);
    vals.push(...f.grades);
  }

  if (f.excludeOptOut) where.push(`b.broadcast_opt_out = 0`);

  if (f.dormantOverDays !== undefined) {
    where.push(`(b.last_contact_at IS NULL OR b.last_contact_at < DATE_SUB(NOW(), INTERVAL ? DAY))`);
    vals.push(f.dormantOverDays);
  }

  // 硬條件：買方預算上限（含彈性）要夠買得起這個物件
  if (f.listingPrice !== undefined) {
    where.push(`(r.budget_max IS NULL OR r.budget_max * (100 + r.budget_flex_pct) / 100 >= ?)`);
    vals.push(f.listingPrice);
    // 也不能低於買方預算下限太多（買方通常不想看太便宜的，代表屋況差）
    where.push(`(r.budget_min IS NULL OR r.budget_min <= ?)`);
    vals.push(f.listingPrice);
  }
  if (f.budgetMin !== undefined) {
    where.push(`r.budget_max >= ?`);
    vals.push(f.budgetMin);
  }
  if (f.budgetMax !== undefined) {
    where.push(`(r.budget_min IS NULL OR r.budget_min <= ?)`);
    vals.push(f.budgetMax);
  }

  if (f.roomMin !== undefined) {
    where.push(`(r.room_min IS NULL OR r.room_min <= ?)`);
    vals.push(f.roomMin);
  }

  if (f.elevator && f.elevator !== "any") {
    // 物件有電梯 → 排除「不要電梯」的人；物件沒電梯 → 排除「一定要電梯」的人
    where.push(f.elevator === "required" ? `r.elevator <> 'exclude'` : `r.elevator <> 'required'`);
  }

  if (f.parking === "none") where.push(`r.parking <> 'required'`);

  if (f.districts?.length) {
    // districts 存 JSON 字串，用 LIKE 比對（TiDB JSON 函式相容性考量，沿用專案作風）
    const parts = f.districts.map(() => `r.districts LIKE ?`);
    where.push(`(${parts.join(" OR ")})`);
    vals.push(...f.districts.map((d) => `%"${d}"%`));
  }

  if (f.communityId) {
    where.push(`EXISTS (SELECT 1 FROM buyer_community bc WHERE bc.buyer_id = b.id AND bc.community_id = ?)`);
    vals.push(f.communityId);
  }

  if (f.tagIds?.length) {
    // 交集：每個標籤都要有
    for (const t of f.tagIds) {
      where.push(`EXISTS (SELECT 1 FROM buyer_tag bt WHERE bt.buyer_id = b.id AND bt.tag_id = ?)`);
      vals.push(t);
    }
  }

  if (f.excludePushedWithinDays !== undefined) {
    where.push(
      `NOT EXISTS (SELECT 1 FROM buyer_broadcast_target t
                    WHERE t.buyer_id = b.id AND t.sent_at IS NOT NULL
                      AND t.sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY))`,
    );
    vals.push(f.excludePushedWithinDays);
  }

  const whereSql = where.join(" AND ");
  const base = `FROM buyer b LEFT JOIN buyer_requirement r ON r.buyer_id = b.id AND r.is_current = 1 WHERE ${whereSql}`;

  const orderSql =
    f.orderBy === "completeness"
      ? `b.completeness_pct DESC, b.heat_score DESC`
      : f.orderBy === "recent"
        ? `b.last_contact_at IS NULL, b.last_contact_at DESC`
        : f.orderBy === "created"
          ? `b.created_at DESC`
          : `b.heat_score DESC, b.completeness_pct DESC`;

  const limit = Math.min(f.limit ?? 100, 500);
  const offset = f.offset ?? 0;

  const rows = await db.$queryRawUnsafe<BuyerListItem[]>(
    `SELECT b.id, b.name, b.phone_norm, b.stage, b.source, b.grade, b.completeness_pct,
            b.heat_score, b.broadcast_opt_out, b.last_contact_at, b.created_at,
            b.decision_maker, b.urgency, b.funding_note,
            r.budget_min, r.budget_max, r.districts, r.room_min, r.elevator, r.parking,
            r.purpose, r.size_min, r.age_max, r.created_at AS req_created_at,
            (SELECT COUNT(*) FROM buyer_tag bt2 WHERE bt2.buyer_id = b.id) AS tag_count
     ${base} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`,
    ...vals,
  );

  const cnt = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c ${base}`,
    ...vals,
  );

  return { rows, total: Number(cnt[0]?.c ?? 0) };
}

/** 沉睡名單 —— 房仲的錢很多是丟在「忘了跟進」上 */
export async function listDormantBuyers(limit = 20): Promise<BuyerListItem[]> {
  const { rows } = await listBuyers({
    dormantOverDays: DORMANT_DAYS,
    stages: ["new", "active", "offering"],
    orderBy: "completeness",
    limit,
  });
  return rows;
}

/** 後台首頁小結：總數、各級數量、待補資料數 */
export async function buyerStats(): Promise<{
  total: number;
  byGrade: Record<string, number>;
  needData: number;
  dormant: number;
}> {
  await ensureBuyerTables();
  const total = await db.$queryRawUnsafe<{ c: bigint | number }[]>(`SELECT COUNT(*) AS c FROM buyer`);
  const grades = await db.$queryRawUnsafe<{ grade: string; c: bigint | number }[]>(
    `SELECT grade, COUNT(*) AS c FROM buyer GROUP BY grade`,
  );
  const needData = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM buyer WHERE completeness_pct < 50 AND stage NOT IN ('closed','cold')`,
  );
  const dormant = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM buyer
      WHERE stage IN ('new','active','offering')
        AND (last_contact_at IS NULL OR last_contact_at < DATE_SUB(NOW(), INTERVAL ? DAY))`,
    DORMANT_DAYS,
  );

  const byGrade: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const g of grades) byGrade[g.grade] = Number(g.c);

  return {
    total: Number(total[0]?.c ?? 0),
    byGrade,
    needData: Number(needData[0]?.c ?? 0),
    dormant: Number(dormant[0]?.c ?? 0),
  };
}

// ---- 示範買方 ----
/**
 * 塞一批示範買方，讓「篩選 × 串聯 × 配對」整條流程不用 API Key 就看得到。
 * ⚠️ 姓名一律加「示範·」前綴，電話用 0900 開頭的測試號段（非真實門號）。
 *    這些是假人，絕對不要拿去打電話。
 */
export async function seedDemoBuyers(): Promise<number> {
  await ensureBuyerTables();
  const existing = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM buyer WHERE name LIKE '示範·%'`,
  );
  if (Number(existing[0]?.c ?? 0) > 0) return 0;

  const tagDefs = await listTagDefs();
  const tagId = (name: string) => tagDefs.find((t) => t.name === name)?.id;

  const demos: Array<{
    name: string;
    phone: string;
    stage: StageKey;
    req: RequirementInput;
    tags: string[];
    decisionMaker?: string;
    funding?: string;
    urgency?: string;
    personality?: string;
    contacts?: Array<{ type: string; content: string; daysAgo: number }>;
  }> = [
    {
      name: "示範·陳先生",
      phone: "0900111001",
      stage: "active",
      decisionMaker: "太太一起決定",
      funding: "自備三成，貸款七成",
      urgency: "asap",
      personality: "講話直接，喜歡先看資料再約時間",
      req: {
        budgetMin: 1100, budgetMax: 1400, budgetFlexPct: 5,
        districts: ["shalu", "qingshui"], roomMin: 3,
        elevator: "required", parking: "required", purpose: "self",
        sizeMin: 35, ageMax: 15,
      },
      tags: ["近高鐵台中站", "電梯大樓", "格局方正"],
      contacts: [
        { type: "call", content: "第一次通話，說想找沙鹿高鐵附近三房", daysAgo: 20 },
        { type: "viewing", content: "帶看沙鹿高鐵首馥，反應不錯但嫌樓層低", daysAgo: 8 },
        { type: "line", content: "問還有沒有同社區高樓層的", daysAgo: 3 },
      ],
    },
    {
      name: "示範·林小姐",
      phone: "0900111002",
      stage: "active",
      decisionMaker: "自己決定",
      urgency: "soon",
      req: {
        budgetMin: 600, budgetMax: 900, budgetFlexPct: 10,
        districts: ["qingshui", "wuqi"], roomMin: 2,
        elevator: "required", parking: "none", purpose: "self",
        ageMax: 20,
      },
      tags: ["首購", "近清水火車站", "電梯大樓"],
      contacts: [
        { type: "line", content: "首購，預算有限，問清水有沒有兩房", daysAgo: 12 },
        { type: "viewing", content: "帶看清水中山名邸，覺得可以但要問家人", daysAgo: 5 },
      ],
    },
    {
      name: "示範·黃大哥",
      phone: "0900111003",
      stage: "offering",
      decisionMaker: "自己",
      funding: "現金為主",
      urgency: "asap",
      personality: "投資客，很看重去化速度與租金報酬",
      req: {
        budgetMin: 1600, budgetMax: 2100, budgetFlexPct: 10,
        districts: ["wuqi", "longjing", "dadu"], roomMin: 4,
        elevator: "any", parking: "required", purpose: "invest",
        sizeMin: 50,
      },
      tags: ["需車位兩個", "邊間"],
      contacts: [
        { type: "meet", content: "面談，討論海線幾個投資標的", daysAgo: 15 },
        { type: "viewing", content: "帶看梧棲海景大苑，已出價 1800", daysAgo: 2 },
      ],
    },
    {
      name: "示範·張太太",
      phone: "0900111004",
      stage: "new",
      req: {
        budgetMax: 700,
        districts: ["shalu"], roomMin: 3,
        elevator: "any", parking: "any", purpose: "unknown",
      },
      tags: [],
      contacts: [{ type: "line", content: "朋友介紹來問，只說想在沙鹿找三房", daysAgo: 40 }],
    },
    {
      name: "示範·吳先生",
      phone: "0900111005",
      stage: "active",
      decisionMaker: "跟爸媽一起看",
      urgency: "explore",
      req: {
        budgetMin: 900, budgetMax: 1300, budgetFlexPct: 0,
        districts: ["longjing", "dadu"], roomMin: 4,
        elevator: "exclude", parking: "required", purpose: "self",
        sizeMin: 55,
      },
      tags: ["透天", "近公園"],
      contacts: [{ type: "call", content: "想找透天，不喜歡大樓管理費", daysAgo: 30 }],
    },
    {
      name: "示範·李小姐",
      phone: "0900111006",
      stage: "new",
      decisionMaker: "先生決定",
      urgency: "soon",
      req: {
        budgetMin: 700, budgetMax: 950, budgetFlexPct: 5,
        districts: ["wuqi", "qingshui"], roomMin: 3,
        elevator: "required", parking: "any", purpose: "self",
        ageMax: 20,
      },
      tags: ["學區宅", "華廈", "近公園"],
      contacts: [{ type: "line", content: "小孩明年上小學，想找學區", daysAgo: 60 }],
    },
  ];

  for (const d of demos) {
    const id = await createBuyer({
      name: d.name,
      phoneRaw: d.phone,
      source: "manual",
      stage: d.stage,
      decisionMaker: d.decisionMaker ?? null,
      fundingNote: d.funding ?? null,
      urgency: d.urgency ?? null,
      personalityNote: d.personality ?? null,
    });

    const ids = d.tags.map(tagId).filter((x): x is string => !!x);
    if (ids.length) await setBuyerTags(id, ids);

    await saveRequirement(id, d.req);

    for (const c of d.contacts ?? []) {
      await addContactLog({
        buyerId: id,
        type: c.type,
        content: c.content,
        occurredAt: new Date(Date.now() - c.daysAgo * 86400_000),
      });
    }
  }

  return demos.length;
}

/** 清掉示範買方 */
export async function clearDemoBuyers(): Promise<number> {
  await ensureBuyerTables();
  const rows = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM buyer WHERE name LIKE '示範·%'`,
  );
  for (const r of rows) await deleteBuyer(r.id);
  return rows.length;
}

export async function deleteBuyer(id: string): Promise<void> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(`DELETE FROM buyer_tag WHERE buyer_id = ?`, id);
  await db.$executeRawUnsafe(`DELETE FROM buyer_community WHERE buyer_id = ?`, id);
  await db.$executeRawUnsafe(`DELETE FROM buyer_contact_log WHERE buyer_id = ?`, id);
  await db.$executeRawUnsafe(`DELETE FROM buyer_requirement WHERE buyer_id = ?`, id);
  await db.$executeRawUnsafe(`DELETE FROM buyer_broadcast_target WHERE buyer_id = ?`, id);
  await db.$executeRawUnsafe(`DELETE FROM buyer WHERE id = ?`, id);
}

export { parseJsonArray };
