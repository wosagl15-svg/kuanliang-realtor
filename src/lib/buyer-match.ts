/**
 * 配對引擎（2026-08-12）
 *
 * 一套計分，兩個查詢方向：
 *   ① 買方 → 找物件（買方配案：輸入需求，從物件庫算符合度排序）
 *   ② 物件 → 找買方（接到新案子，撈出當初想買這類物件的那批人）
 *
 * 🔴 硬條件不符 = 直接排除，不給分數。
 *    推一間買方明確說過不要的物件，傷的是專業信任 —— 那比少推一間貴得多。
 * 🔵 軟條件只影響排序，並且**每一項都要能說出理由**。
 *    業務要能跟客戶解釋「為什麼推這間給你」，不能只給一個 87% 的黑箱數字。
 */
import { db } from "@/lib/db";
import { ensureBuyerTables } from "@/lib/buyer-schema";
import { REQUIREMENT_STALE_DAYS, districtLabel } from "@/lib/buyer-constants";
import { parseJsonArray } from "@/lib/buyer";

export type ListingRow = {
  id: string;
  title: string;
  community_id: string | null;
  district: string;
  address: string | null;
  price: number | null;
  size_ping: number | null;
  rooms: number | null;
  living_rooms: number | null;
  baths: number | null;
  floor_no: number | null;
  total_floors: number | null;
  age_year: number | null;
  has_elevator: number | null;
  parking_count: number;
  property_type: string;
  status: string;
  tags_json: string | null;
  note: string | null;
  is_demo: number;
};

export type RequirementLike = {
  budget_min: number | null;
  budget_max: number | null;
  budget_flex_pct: number;
  districts: string | null;
  room_min: number | null;
  elevator: string;
  parking: string;
  purpose: string;
  size_min: number | null;
  size_max: number | null;
  age_max: number | null;
  created_at?: Date | null;
  /** 買方指定的社區 id 清單 */
  communityIds?: string[];
  /** 買方標籤名稱 */
  tags?: string[];
};

export type MatchResult = {
  score: number; // 0–100
  passed: boolean;
  /** 不符的硬條件（passed=false 時看這個，要能明確告訴業務為什麼排除） */
  blockers: string[];
  /** 符合的理由，給業務拿去跟客戶說 */
  reasons: string[];
  /** 需要留意的地方（軟條件不符但沒到排除） */
  cautions: string[];
};

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 核心計分：一個需求 × 一個物件。
 * 兩個查詢方向都呼叫這支，所以「買方配案」和「物件找買方」的結果永遠一致 ——
 * 不會發生 A 頁說符合、B 頁說不符合的鬼打牆。
 */
export function matchScore(req: RequirementLike, listing: ListingRow): MatchResult {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const cautions: string[] = [];

  const price = num(listing.price);
  const budgetMax = num(req.budget_max);
  const budgetMin = num(req.budget_min);
  const flex = req.budget_flex_pct || 0;

  // ---- 硬條件 ----

  // 1. 總價（含彈性）
  if (budgetMax !== null && price !== null) {
    const ceiling = budgetMax * (1 + flex / 100);
    if (price > ceiling) {
      blockers.push(
        `總價 ${price} 萬超過預算上限 ${budgetMax} 萬${flex ? `（含彈性 ${flex}% = ${Math.round(ceiling)} 萬）` : ""}`,
      );
    }
  }

  // 2. 區域
  const wantDistricts = parseJsonArray(req.districts);
  if (wantDistricts.length && listing.district && !wantDistricts.includes(listing.district)) {
    // 指定社區命中時，區域不符可以放行（客戶指名要那個社區，區域就不是限制）
    const communityHit = !!listing.community_id && (req.communityIds ?? []).includes(listing.community_id);
    if (!communityHit) {
      blockers.push(
        `${districtLabel(listing.district)}不在意向區域（${wantDistricts.map(districtLabel).join("、")}）`,
      );
    }
  }

  // 3. 房數
  const roomMin = num(req.room_min);
  const rooms = num(listing.rooms);
  if (roomMin !== null && roomMin > 0 && rooms !== null && rooms < roomMin) {
    blockers.push(`${rooms} 房不足最少 ${roomMin} 房`);
  }

  // 4. 電梯
  if (req.elevator === "required" && listing.has_elevator === 0) {
    blockers.push("客戶指定要電梯，此物件無電梯");
  }
  if (req.elevator === "exclude" && listing.has_elevator === 1) {
    blockers.push("客戶指定不要電梯大樓");
  }

  // 5. 車位
  if (req.parking === "required" && listing.parking_count <= 0) {
    blockers.push("客戶指定一定要車位，此物件無車位");
  }

  // 6. 物件類型
  if (listing.status !== "onsale") blockers.push(`物件狀態為 ${listing.status}，非在售中`);

  if (blockers.length) {
    return { score: 0, passed: false, blockers, reasons, cautions };
  }

  // ---- 軟條件計分 ----
  let score = 50; // 通過所有硬條件的基礎分

  // 指定社區命中 —— 權重最高，客戶指名要的
  if (listing.community_id && (req.communityIds ?? []).includes(listing.community_id)) {
    score += 25;
    reasons.push("正是客戶指定的社區");
  } else if (wantDistricts.includes(listing.district)) {
    score += 10;
    reasons.push(`位在意向區域${districtLabel(listing.district)}`);
  }

  // 價格落點：越接近預算上限、又不超過，通常代表買得到最好的
  if (price !== null && budgetMax !== null) {
    const ratio = price / budgetMax;
    if (ratio >= 0.8 && ratio <= 1) {
      score += 10;
      reasons.push(`總價 ${price} 萬貼近預算（上限 ${budgetMax} 萬）`);
    } else if (ratio < 0.8) {
      score += 6;
      reasons.push(`總價 ${price} 萬，低於預算 ${Math.round((1 - ratio) * 100)}%`);
      if (budgetMin !== null && price < budgetMin) {
        cautions.push(`低於客戶預算下限 ${budgetMin} 萬，可能屋況或條件有落差，帶看前先確認`);
      }
    } else {
      // 在彈性範圍內但超過原上限
      cautions.push(`總價 ${price} 萬已超出原預算 ${budgetMax} 萬，需先探詢客戶是否願意加`);
    }
  }

  // 房數
  if (roomMin !== null && rooms !== null) {
    if (rooms === roomMin) {
      score += 6;
      reasons.push(`${rooms} 房，正好符合`);
    } else if (rooms > roomMin) {
      score += 4;
      reasons.push(`${rooms} 房，多於需求的 ${roomMin} 房`);
    }
  }

  // 坪數
  const size = num(listing.size_ping);
  const sizeMin = num(req.size_min);
  const sizeMax = num(req.size_max);
  if (size !== null && (sizeMin !== null || sizeMax !== null)) {
    const okMin = sizeMin === null || size >= sizeMin;
    const okMax = sizeMax === null || size <= sizeMax;
    if (okMin && okMax) {
      score += 8;
      reasons.push(`${size} 坪符合坪數需求`);
    } else {
      score -= 5;
      cautions.push(
        `${size} 坪不在需求區間（${sizeMin ?? "不限"}～${sizeMax ?? "不限"} 坪）`,
      );
    }
  }

  // 屋齡
  const age = num(listing.age_year);
  const ageMax = num(req.age_max);
  if (age !== null && ageMax !== null) {
    if (age <= ageMax) {
      score += 6;
      reasons.push(`屋齡 ${age} 年，在可接受的 ${ageMax} 年內`);
    } else {
      score -= 8;
      cautions.push(`屋齡 ${age} 年超過客戶可接受的 ${ageMax} 年`);
    }
  }

  // 車位加分
  if (listing.parking_count > 0) {
    if (req.parking === "required") {
      score += 5;
      reasons.push(`附 ${listing.parking_count} 個車位`);
    } else if (req.parking === "buyable" || req.parking === "any") {
      score += 3;
      reasons.push(`含車位 ${listing.parking_count} 個`);
    }
  }

  // 電梯加分
  if (listing.has_elevator === 1 && req.elevator === "required") {
    score += 3;
    reasons.push("有電梯");
  }

  // 標籤重疊
  const listingTags = parseJsonArray(listing.tags_json);
  const buyerTags = req.tags ?? [];
  const overlap = listingTags.filter((t) => buyerTags.includes(t));
  if (overlap.length) {
    score += Math.min(overlap.length * 4, 12);
    reasons.push(`符合需求標籤：${overlap.join("、")}`);
  }

  // 需求過期降權 —— 三個月前的需求拿來配對，比出來的東西不能全信
  if (req.created_at) {
    const days = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 86400_000);
    if (days > REQUIREMENT_STALE_DAYS) {
      score = Math.round(score * 0.85);
      cautions.push(`需求已 ${days} 天沒更新，建議先確認條件是否有變`);
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, passed: true, blockers, reasons, cautions };
}

// ---- 方向①：買方 → 找物件（買方配案）----

export type ListingMatch = ListingRow & { match: MatchResult };

export async function matchListingsForRequirement(
  req: RequirementLike,
  opts: { includeFailed?: boolean; limit?: number } = {},
): Promise<{ matched: ListingMatch[]; total: number; passedCount: number }> {
  await ensureBuyerTables();
  const listings = await db.$queryRawUnsafe<ListingRow[]>(
    `SELECT * FROM listing WHERE status = 'onsale' ORDER BY created_at DESC LIMIT 500`,
  );

  const scored = listings.map((l) => ({ ...l, match: matchScore(req, l) }));
  const passed = scored.filter((s) => s.match.passed).sort((a, b) => b.match.score - a.match.score);
  const failed = scored.filter((s) => !s.match.passed);

  const out = opts.includeFailed ? [...passed, ...failed] : passed;
  return {
    matched: out.slice(0, opts.limit ?? 100),
    total: listings.length,
    passedCount: passed.length,
  };
}

// ---- 方向②：物件 → 找買方 ----

export type BuyerMatch = {
  buyer_id: string;
  name: string;
  phone_norm: string;
  stage: string;
  grade: string;
  completeness_pct: number;
  heat_score: number;
  broadcast_opt_out: number;
  last_contact_at: Date | null;
  match: MatchResult;
};

export async function matchBuyersForListing(
  listingId: string,
  opts: { excludePushedWithinDays?: number; limit?: number } = {},
): Promise<{ matched: BuyerMatch[]; listing: ListingRow | null; scanned: number }> {
  await ensureBuyerTables();

  const lrows = await db.$queryRawUnsafe<ListingRow[]>(`SELECT * FROM listing WHERE id = ? LIMIT 1`, listingId);
  const listing = lrows[0] ?? null;
  if (!listing) return { matched: [], listing: null, scanned: 0 };

  // 撈出所有還在經營中的買方 + 當前需求
  const rows = await db.$queryRawUnsafe<
    Array<
      RequirementLike & {
        buyer_id: string;
        name: string;
        phone_norm: string;
        stage: string;
        grade: string;
        completeness_pct: number;
        heat_score: number;
        broadcast_opt_out: number;
        last_contact_at: Date | null;
      }
    >
  >(
    `SELECT b.id AS buyer_id, b.name, b.phone_norm, b.stage, b.grade, b.completeness_pct,
            b.heat_score, b.broadcast_opt_out, b.last_contact_at,
            r.budget_min, r.budget_max, r.budget_flex_pct, r.districts, r.room_min,
            r.elevator, r.parking, r.purpose, r.size_min, r.size_max, r.age_max, r.created_at
       FROM buyer b
       LEFT JOIN buyer_requirement r ON r.buyer_id = b.id AND r.is_current = 1
      WHERE b.stage NOT IN ('closed','cold')
      LIMIT 2000`,
  );

  // 一次撈齊買方的指定社區與標籤，避免 N+1
  const comm = await db.$queryRawUnsafe<{ buyer_id: string; community_id: string }[]>(
    `SELECT buyer_id, community_id FROM buyer_community`,
  );
  const tags = await db.$queryRawUnsafe<{ buyer_id: string; name: string }[]>(
    `SELECT t.buyer_id, d.name FROM buyer_tag t JOIN buyer_tag_def d ON d.id = t.tag_id`,
  );

  const commMap = new Map<string, string[]>();
  for (const c of comm) {
    const arr = commMap.get(c.buyer_id) ?? [];
    arr.push(c.community_id);
    commMap.set(c.buyer_id, arr);
  }
  const tagMap = new Map<string, string[]>();
  for (const t of tags) {
    const arr = tagMap.get(t.buyer_id) ?? [];
    arr.push(t.name);
    tagMap.set(t.buyer_id, arr);
  }

  const matched: BuyerMatch[] = [];
  for (const r of rows) {
    // 完全沒建需求的買方無法配對 —— 但要讓業務知道有這些人（在 UI 用「待補資料」提示）
    if (r.budget_max === null && !parseJsonArray(r.districts).length && r.room_min === null) continue;

    const req: RequirementLike = {
      ...r,
      communityIds: commMap.get(r.buyer_id) ?? [],
      tags: tagMap.get(r.buyer_id) ?? [],
    };
    const m = matchScore(req, listing);
    if (!m.passed) continue;

    matched.push({
      buyer_id: r.buyer_id,
      name: r.name,
      phone_norm: r.phone_norm,
      stage: r.stage,
      grade: r.grade,
      completeness_pct: r.completeness_pct,
      heat_score: r.heat_score,
      broadcast_opt_out: r.broadcast_opt_out,
      last_contact_at: r.last_contact_at,
      match: m,
    });
  }

  // 排序：配對分數為主，互動熱度為輔 —— 同樣符合的，先推給比較熱的
  matched.sort((a, b) => b.match.score - a.match.score || b.heat_score - a.heat_score);

  let out = matched;
  if (opts.excludePushedWithinDays !== undefined && matched.length) {
    const ids = matched.map((m) => m.buyer_id);
    const recent = await db.$queryRawUnsafe<{ buyer_id: string }[]>(
      `SELECT DISTINCT buyer_id FROM buyer_broadcast_target
        WHERE sent_at IS NOT NULL AND sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND buyer_id IN (${ids.map(() => "?").join(",")})`,
      opts.excludePushedWithinDays,
      ...ids,
    );
    const blocked = new Set(recent.map((r) => r.buyer_id));
    out = matched.filter((m) => !blocked.has(m.buyer_id));
  }

  return { matched: out.slice(0, opts.limit ?? 200), listing, scanned: rows.length };
}
