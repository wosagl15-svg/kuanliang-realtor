/**
 * 物件庫（2026-08-12）
 *
 * 配案功能的另一半 —— 沒有物件庫就算不出符合度。
 * ⚠️ 不接 591、不爬任何外部網站（系統擁有者拍板：違反使用條款、無差異化、資料會過期）。
 *    物件一律自己建，或從公司內網人工帶入。
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ensureBuyerTables } from "@/lib/buyer-schema";
import type { ListingRow } from "@/lib/buyer-match";

export type ListingInput = {
  title: string;
  communityId?: string | null;
  district: string;
  address?: string | null;
  price?: number | null;
  sizePing?: number | null;
  rooms?: number | null;
  livingRooms?: number | null;
  baths?: number | null;
  floorNo?: number | null;
  totalFloors?: number | null;
  ageYear?: number | null;
  hasElevator?: boolean | null;
  parkingCount?: number;
  propertyType?: string;
  status?: string;
  tags?: string[];
  note?: string | null;
  isDemo?: boolean;
};

export async function listListings(opts: { status?: string; district?: string } = {}): Promise<ListingRow[]> {
  await ensureBuyerTables();
  const where: string[] = ["1=1"];
  const vals: unknown[] = [];
  if (opts.status) {
    where.push("status = ?");
    vals.push(opts.status);
  }
  if (opts.district) {
    where.push("district = ?");
    vals.push(opts.district);
  }
  return db.$queryRawUnsafe<ListingRow[]>(
    `SELECT * FROM listing WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 500`,
    ...vals,
  );
}

export async function getListing(id: string): Promise<ListingRow | null> {
  await ensureBuyerTables();
  const rows = await db.$queryRawUnsafe<ListingRow[]>(`SELECT * FROM listing WHERE id = ? LIMIT 1`, id);
  return rows[0] ?? null;
}

export async function createListing(input: ListingInput): Promise<string> {
  await ensureBuyerTables();
  const id = `lst_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await db.$executeRawUnsafe(
    `INSERT INTO listing
      (id, title, community_id, district, address, price, size_ping, rooms, living_rooms, baths,
       floor_no, total_floors, age_year, has_elevator, parking_count, property_type, status,
       tags_json, note, is_demo)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    input.title.trim(),
    input.communityId ?? null,
    input.district,
    input.address ?? null,
    input.price ?? null,
    input.sizePing ?? null,
    input.rooms ?? null,
    input.livingRooms ?? null,
    input.baths ?? null,
    input.floorNo ?? null,
    input.totalFloors ?? null,
    input.ageYear ?? null,
    input.hasElevator === null || input.hasElevator === undefined ? null : input.hasElevator ? 1 : 0,
    input.parkingCount ?? 0,
    input.propertyType ?? "house",
    input.status ?? "onsale",
    JSON.stringify(input.tags ?? []),
    input.note ?? null,
    input.isDemo ? 1 : 0,
  );
  return id;
}

export async function updateListingStatus(id: string, status: string): Promise<void> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(`UPDATE listing SET status = ? WHERE id = ?`, status, id);
}

export async function deleteListing(id: string): Promise<void> {
  await ensureBuyerTables();
  await db.$executeRawUnsafe(`DELETE FROM listing WHERE id = ?`, id);
}

/**
 * 塞示範物件，讓配案畫面先跑起來。
 * ⚠️ 標題一律加「示範·」且 is_demo=1。
 *    絕不假造真實社區的價格與屋況 —— 那種資料被當真拿去跟客戶講會出事。
 *    真實物件請自己建，或用「貼物件描述 → AI 抽欄位」（下一版）。
 */
export async function seedDemoListings(): Promise<number> {
  await ensureBuyerTables();
  const existing = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM listing WHERE is_demo = 1`,
  );
  if (Number(existing[0]?.c ?? 0) > 0) return 0;

  // 對應 community.ts 的示範社區（用名稱找 id，找不到就掛 null）
  const comms = await db.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, name FROM community WHERE is_demo = 1`,
  );
  const byName = (frag: string) => comms.find((c) => c.name.includes(frag))?.id ?? null;

  const demos: ListingInput[] = [
    {
      title: "示範·沙鹿高鐵首馥 三房車位",
      communityId: byName("首馥"),
      district: "shalu",
      price: 1280,
      sizePing: 38.5,
      rooms: 3,
      livingRooms: 2,
      baths: 2,
      floorNo: 8,
      totalFloors: 14,
      ageYear: 6,
      hasElevator: true,
      parkingCount: 1,
      tags: ["近高鐵台中站", "電梯大樓", "採光佳", "格局方正"],
      isDemo: true,
    },
    {
      title: "示範·清水中山名邸 兩房首購",
      communityId: byName("名邸"),
      district: "qingshui",
      price: 738,
      sizePing: 26.2,
      rooms: 2,
      livingRooms: 1,
      baths: 1,
      floorNo: 4,
      totalFloors: 7,
      ageYear: 13,
      hasElevator: true,
      parkingCount: 0,
      tags: ["近清水火車站", "電梯大樓", "首購", "近市場"],
      isDemo: true,
    },
    {
      title: "示範·梧棲海景大苑 四房雙車位",
      communityId: byName("海景"),
      district: "wuqi",
      price: 1880,
      sizePing: 52.4,
      rooms: 4,
      livingRooms: 2,
      baths: 3,
      floorNo: 12,
      totalFloors: 18,
      ageYear: 9,
      hasElevator: true,
      parkingCount: 2,
      tags: ["電梯大樓", "邊間", "雙衛", "採光佳", "需車位兩個"],
      isDemo: true,
    },
    {
      title: "示範·龍井文青透天 四房車庫",
      communityId: byName("文青"),
      district: "longjing",
      price: 1150,
      sizePing: 62.0,
      rooms: 4,
      livingRooms: 2,
      baths: 3,
      totalFloors: 4,
      ageYear: 17,
      hasElevator: false,
      parkingCount: 1,
      tags: ["透天", "近交流道"],
      isDemo: true,
    },
    {
      title: "示範·大肚山麓別墅 五房庭院",
      communityId: byName("山麓"),
      district: "dadu",
      price: 1980,
      sizePing: 88.0,
      rooms: 5,
      livingRooms: 2,
      baths: 4,
      totalFloors: 3,
      ageYear: 20,
      hasElevator: false,
      parkingCount: 2,
      tags: ["透天", "近公園"],
      isDemo: true,
    },
    {
      title: "示範·沙鹿靜巷公寓 三房低總價",
      district: "shalu",
      price: 598,
      sizePing: 31.0,
      rooms: 3,
      livingRooms: 2,
      baths: 1,
      floorNo: 3,
      totalFloors: 5,
      ageYear: 32,
      hasElevator: false,
      parkingCount: 0,
      tags: ["公寓", "近市場", "首購"],
      isDemo: true,
    },
    {
      title: "示範·清水近Costco 三房平車",
      district: "qingshui",
      price: 1080,
      sizePing: 41.8,
      rooms: 3,
      livingRooms: 2,
      baths: 2,
      floorNo: 6,
      totalFloors: 12,
      ageYear: 4,
      hasElevator: true,
      parkingCount: 1,
      tags: ["近Costco", "電梯大樓", "新成屋", "格局方正"],
      isDemo: true,
    },
    {
      title: "示範·梧棲學區華廈 三房",
      district: "wuqi",
      price: 858,
      sizePing: 34.6,
      rooms: 3,
      livingRooms: 2,
      baths: 2,
      floorNo: 5,
      totalFloors: 8,
      ageYear: 15,
      hasElevator: true,
      parkingCount: 1,
      tags: ["華廈", "學區宅", "近公園"],
      isDemo: true,
    },
  ];

  for (const d of demos) await createListing(d);
  return demos.length;
}

/** 後台小結 */
export async function listingStats(): Promise<{ total: number; onsale: number; demo: number }> {
  await ensureBuyerTables();
  const r = await db.$queryRawUnsafe<{ total: bigint | number; onsale: bigint | number; demo: bigint | number }[]>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status='onsale' THEN 1 ELSE 0 END) AS onsale,
            SUM(CASE WHEN is_demo=1 THEN 1 ELSE 0 END) AS demo
       FROM listing`,
  );
  return {
    total: Number(r[0]?.total ?? 0),
    onsale: Number(r[0]?.onsale ?? 0),
    demo: Number(r[0]?.demo ?? 0),
  };
}
