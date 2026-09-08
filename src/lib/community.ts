/**
 * 社區主檔（2026-08-12）
 *
 * 🔴 這是整套系統的地基之一。
 * 「接到某社區委託 → 自動撈出所有想買該社區的買方」這個功能，
 * 只要社區名稱是自由輸入就永遠做不出來 —— 因為實際上會被輸入成
 * 太子哈佛 / 哈佛 / 哈佛大苑 / 太子哈佛B棟 / 哈佛(近高鐵)，系統看起來是五個社區。
 *
 * 解法：社區建成主檔，每個社區有唯一 id、正式名稱、一堆別名。
 * 買方和物件都只能「掛」到這個 id 上。
 * 附帶好處：走路到高鐵幾分鐘這種資訊建一次就好，不用每個客戶都問一次。
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ensureBuyerTables } from "@/lib/buyer-schema";

export type CommunityRow = {
  id: string;
  name: string;
  aliases: string | null;
  district: string;
  address: string | null;
  has_elevator: number | null;
  parking_type: string | null;
  built_year: number | null;
  total_units: number | null;
  walk_min_hsr: number | null;
  walk_min_train: number | null;
  school_zone: string | null;
  note: string | null;
  kind: string | null;
  is_demo: number;
  created_at: Date;
};

export type Community = Omit<CommunityRow, "aliases" | "has_elevator" | "is_demo"> & {
  aliases: string[];
  hasElevator: boolean | null;
  isDemo: boolean;
};

function toCommunity(r: CommunityRow): Community {
  return {
    ...r,
    aliases: parseAliases(r.aliases),
    hasElevator: r.has_elevator === null ? null : r.has_elevator === 1,
    isDemo: r.is_demo === 1,
  };
}

function parseAliases(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 比對用的正規化鍵：全形轉半形、去空白與常見雜訊符號、統一大小寫。
 * 「太子哈佛 B棟」「太子哈佛(近高鐵)」「太子哈佛　」都會收斂成同一個鍵的前綴。
 */
export function normalizeCommunityKey(s: string): string {
  return s
    .normalize("NFKC") // 全形英數 → 半形
    .replace(/[\s　]/g, "") // 去所有空白（含全形空格）
    .replace(/[()（）「」【】\[\]．·、,，.。\-_/]/g, "") // 去括號與標點
    .toLowerCase();
}

export async function listCommunities(district?: string): Promise<Community[]> {
  await ensureBuyerTables();
  const rows = district
    ? await db.$queryRawUnsafe<CommunityRow[]>(
        `SELECT * FROM community WHERE district = ? ORDER BY name LIMIT 1000`,
        district,
      )
    : await db.$queryRawUnsafe<CommunityRow[]>(`SELECT * FROM community ORDER BY district, name LIMIT 1000`);
  return rows.map(toCommunity);
}

export async function getCommunity(id: string): Promise<Community | null> {
  await ensureBuyerTables();
  const rows = await db.$queryRawUnsafe<CommunityRow[]>(`SELECT * FROM community WHERE id = ? LIMIT 1`, id);
  return rows[0] ? toCommunity(rows[0]) : null;
}

/**
 * 用任意寫法找社區 —— 這是「情境 A：接到社區委託撈買方」的入口。
 * 比對順序：正式名完全相同 → 別名完全相同 → 正式名/別名互為包含（處理「哈佛」找到「太子哈佛」）。
 * 回傳依吻合強度排序，讓呼叫端可以只取第一筆，或列出來讓人選。
 */
export async function findCommunities(query: string): Promise<Array<Community & { matchKind: string }>> {
  await ensureBuyerTables();
  const q = normalizeCommunityKey(query);
  if (!q) return [];

  const all = await listCommunities();
  const scored: Array<Community & { matchKind: string; _score: number }> = [];

  for (const c of all) {
    const nameKey = normalizeCommunityKey(c.name);
    const aliasKeys = c.aliases.map(normalizeCommunityKey);

    let score = 0;
    let kind = "";
    if (nameKey === q) {
      score = 100;
      kind = "正式名稱";
    } else if (aliasKeys.includes(q)) {
      score = 90;
      kind = "別名";
    } else if (nameKey.includes(q)) {
      score = 70;
      kind = "名稱包含";
    } else if (aliasKeys.some((a) => a.includes(q))) {
      score = 60;
      kind = "別名包含";
    } else if (q.includes(nameKey) && nameKey.length >= 2) {
      // 使用者打「太子哈佛B棟」，主檔只有「太子哈佛」
      score = 50;
      kind = "輸入較長";
    }

    if (score > 0) scored.push({ ...c, matchKind: kind, _score: score });
  }

  scored.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name, "zh-TW"));
  return scored.map(({ _score, ...rest }) => rest);
}

export type CommunityInput = {
  name: string;
  /** 型態：building 電梯大樓／華廈、community 社區、house 獨棟透天 */
  kind?: string | null;
  aliases?: string[];
  district: string;
  address?: string | null;
  hasElevator?: boolean | null;
  parkingType?: string | null;
  builtYear?: number | null;
  totalUnits?: number | null;
  walkMinHsr?: number | null;
  walkMinTrain?: number | null;
  schoolZone?: string | null;
  note?: string | null;
  isDemo?: boolean;
};

export async function createCommunity(input: CommunityInput): Promise<string> {
  await ensureBuyerTables();
  const id = `cmty_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await db.$executeRawUnsafe(
    `INSERT INTO community
      (id, name, aliases, district, address, has_elevator, parking_type, built_year,
       total_units, walk_min_hsr, walk_min_train, school_zone, note, kind, is_demo)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.name.trim(),
    JSON.stringify(input.aliases ?? []),
    input.district,
    input.address ?? null,
    input.hasElevator === null || input.hasElevator === undefined ? null : input.hasElevator ? 1 : 0,
    input.parkingType ?? null,
    input.builtYear ?? null,
    input.totalUnits ?? null,
    input.walkMinHsr ?? null,
    input.walkMinTrain ?? null,
    input.schoolZone ?? null,
    input.note ?? null,
    input.kind ?? null,
    input.isDemo ? 1 : 0,
  );
  return id;
}

export async function updateCommunity(id: string, input: Partial<CommunityInput>): Promise<void> {
  await ensureBuyerTables();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const push = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };

  if (input.name !== undefined) push("name", input.name.trim());
  if (input.aliases !== undefined) push("aliases", JSON.stringify(input.aliases));
  if (input.district !== undefined) push("district", input.district);
  if (input.address !== undefined) push("address", input.address);
  if (input.hasElevator !== undefined)
    push("has_elevator", input.hasElevator === null ? null : input.hasElevator ? 1 : 0);
  if (input.parkingType !== undefined) push("parking_type", input.parkingType);
  if (input.builtYear !== undefined) push("built_year", input.builtYear);
  if (input.totalUnits !== undefined) push("total_units", input.totalUnits);
  if (input.walkMinHsr !== undefined) push("walk_min_hsr", input.walkMinHsr);
  if (input.walkMinTrain !== undefined) push("walk_min_train", input.walkMinTrain);
  if (input.schoolZone !== undefined) push("school_zone", input.schoolZone);
  if (input.note !== undefined) push("note", input.note);
  if (input.kind !== undefined) push("kind", input.kind);

  if (!sets.length) return;
  vals.push(id);
  await db.$executeRawUnsafe(`UPDATE community SET ${sets.join(", ")} WHERE id = ?`, ...vals);
}

export async function deleteCommunity(id: string): Promise<void> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(`DELETE FROM buyer_community WHERE community_id = ?`, id);
  await db.$executeRawUnsafe(`UPDATE listing SET community_id = NULL WHERE community_id = ?`, id);
  await db.$executeRawUnsafe(`DELETE FROM community WHERE id = ?`, id);
}

/**
 * 加別名（不重複）。實務上最常用：發現客戶都叫它「哈佛」，就把這個別名加進去，
 * 之後全系統的搜尋都認得。
 */
export async function addAlias(id: string, alias: string): Promise<void> {
  const c = await getCommunity(id);
  if (!c) return;
  const key = normalizeCommunityKey(alias);
  if (!key) return;
  if (c.aliases.some((a) => normalizeCommunityKey(a) === key)) return;
  await updateCommunity(id, { aliases: [...c.aliases, alias.trim()] });
}

/** 這個社區有多少買方在等（情境 A 的核心數字） */
export async function countBuyersWanting(communityId: string): Promise<number> {
  await ensureBuyerTables();
  const rows = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM buyer_community bc
       JOIN buyer b ON b.id = bc.buyer_id
      WHERE bc.community_id = ? AND b.stage NOT IN ('closed','cold')`,
    communityId,
  );
  return Number(rows[0]?.c ?? 0);
}

// ---- 示範資料 ----
/**
 * 一鍵塞示範社區，讓畫面先跑起來。
 * ⚠️ 名稱一律加「示範·」前綴且 is_demo=1 —— 絕不假造真實社區的屋齡、車位、通勤時間，
 *    那種假資料一旦被當真拿去跟客戶講，是會出事的。真實社區請自己在後台建。
 */
export async function seedDemoCommunities(): Promise<number> {
  await ensureBuyerTables();
  const existing = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM community WHERE is_demo = 1`,
  );
  if (Number(existing[0]?.c ?? 0) > 0) return 0;

  const demos: CommunityInput[] = [
    {
      name: "示範·沙鹿高鐵首馥",
      aliases: ["示範首馥", "首馥"],
      district: "shalu",
      hasElevator: true,
      parkingType: "平面",
      builtYear: 2019,
      totalUnits: 168,
      walkMinHsr: 8,
      schoolZone: "示範國小／示範國中",
      isDemo: true,
    },
    {
      name: "示範·清水中山名邸",
      aliases: ["示範名邸", "中山名邸"],
      district: "qingshui",
      hasElevator: true,
      parkingType: "機械",
      builtYear: 2012,
      totalUnits: 92,
      walkMinTrain: 6,
      isDemo: true,
    },
    {
      name: "示範·梧棲海景大苑",
      aliases: ["示範海景", "海景大苑"],
      district: "wuqi",
      hasElevator: true,
      parkingType: "平面",
      builtYear: 2016,
      totalUnits: 210,
      isDemo: true,
    },
    {
      name: "示範·龍井文青透天",
      aliases: ["示範文青"],
      district: "longjing",
      hasElevator: false,
      parkingType: "車庫",
      builtYear: 2008,
      isDemo: true,
    },
    {
      name: "示範·大肚山麓別墅",
      aliases: ["示範山麓"],
      district: "dadu",
      hasElevator: false,
      parkingType: "庭院",
      builtYear: 2005,
      isDemo: true,
    },
  ];

  for (const d of demos) await createCommunity(d);
  return demos.length;
}

/** 清掉所有示範資料（社區＋物件），準備上真實資料時用 */
export async function clearDemoData(): Promise<{ communities: number; listings: number }> {
  await ensureBuyerTables();
  const l = await db.$executeRawUnsafe(`DELETE FROM listing WHERE is_demo = 1`);
  const demoIds = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM community WHERE is_demo = 1`);
  for (const { id } of demoIds) await deleteCommunity(id);
  return { communities: demoIds.length, listings: Number(l) };
}
