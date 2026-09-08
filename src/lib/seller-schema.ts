/**
 * 賣方（屋主）資料庫 — 建表（2026-08-22）
 *
 * 🚨 全 additive：新表，不改 buyer / listing / appointment 任何既有邏輯。
 *    唯一動到既有表的是 `listing.seller_id` 一欄，走 ensureColumn 補（見下方註解）。
 *
 * 沿用專案慣例：不進 prisma schema，第一次用到時自己 CREATE TABLE IF NOT EXISTS。
 *
 * TiDB 注意事項（沿用 appointment.ts / buyer-schema.ts 踩過的坑）：
 *   - 不用 STORED 生成欄
 *   - JSON 一律存 LONGTEXT，程式端 parse
 */
import { db } from "@/lib/db";
import { schemaGate } from "@/lib/schema-gate";

let ensured = false;

/**
 * ⚠️ 這個檔每加一張表、每加一個 ensureColumn，**這個數字就要 +1**。
 *    忘了 +1 → 正式站會直接跳過新的 DDL，查詢時噴 Unknown column（見 schema-gate.ts）。
 */
const SCHEMA_VERSION = 1;

export async function ensureSellerTables(): Promise<void> {
  if (ensured) return;
  await schemaGate("seller", SCHEMA_VERSION, buildSellerTables);
  ensured = true;
}

async function buildSellerTables(): Promise<void> {

  // ---- 賣方主檔 ----
  //
  // intent_score / intent_label 是「他到底真的要不要賣」的判讀結果，
  // 每次新增聯絡紀錄都會重算（見 seller.ts recomputeSeller）。
  // 存起來而不是每次查詢時算，是因為列表頁要拿它排序 —— 排序在 SQL 裡才快。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seller (
      id               VARCHAR(64)  NOT NULL,
      name             VARCHAR(80)  NOT NULL DEFAULT '',
      phone_norm       VARCHAR(20)  NOT NULL DEFAULT '',
      phone_raw        VARCHAR(60)  NULL,
      line_user_id     VARCHAR(120) NULL,
      email            VARCHAR(160) NULL,
      source           VARCHAR(24)  NOT NULL DEFAULT 'manual',
      stage            VARCHAR(16)  NOT NULL DEFAULT 'lead',
      motive           VARCHAR(16)  NOT NULL DEFAULT 'unknown',
      motive_note      LONGTEXT     NULL,
      price_flex       VARCHAR(16)  NOT NULL DEFAULT 'unknown',
      ask_price        INT          NULL,
      bottom_price     INT          NULL,
      decision_maker   VARCHAR(160) NULL,
      co_owner_note    LONGTEXT     NULL,
      deadline_at      DATE         NULL,
      mandate_start    DATE         NULL,
      mandate_end      DATE         NULL,
      mandate_kind     VARCHAR(16)  NULL,
      personality_note LONGTEXT     NULL,
      intent_score     INT          NOT NULL DEFAULT 0,
      intent_label     VARCHAR(24)  NOT NULL DEFAULT 'unknown',
      last_contact_at  DATETIME     NULL,
      last_report_at   DATETIME     NULL,
      appointment_id   VARCHAR(64)  NULL,
      is_demo          TINYINT(1)   NOT NULL DEFAULT 0,
      created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY seller_phone_idx (phone_norm),
      KEY seller_stage_idx (stage, last_report_at),
      KEY seller_intent_idx (intent_score),
      KEY seller_name_idx (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 聯絡歷程 ----
  //
  // 這張表是整套賣方系統的心臟。意圖分析、屋主回報表、續約談判的籌碼，
  // 全部都是從這裡長出來的 —— 沒有逐次紀錄，後面兩個功能都只能編。
  //
  // price_mentioned：這次談話中屋主講到的數字。單獨存一欄（而不是埋在 content 裡），
  //   是為了畫出「開價鬆動曲線」—— 1280 → 1250 → 1230 這條線比任何話術都有說服力。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seller_contact_log (
      id              VARCHAR(64)  NOT NULL,
      seller_id       VARCHAR(64)  NOT NULL,
      listing_id      VARCHAR(64)  NULL,
      type            VARCHAR(16)  NOT NULL DEFAULT 'note',
      content         LONGTEXT     NULL,
      sentiment       VARCHAR(16)  NULL,
      price_mentioned INT          NULL,
      appointment_id  VARCHAR(64)  NULL,
      occurred_at     DATETIME     NOT NULL,
      created_by      VARCHAR(160) NULL,
      created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY slog_seller_idx (seller_id, occurred_at),
      KEY slog_type_idx (type, occurred_at),
      KEY slog_listing_idx (listing_id, occurred_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 屋主回報表存檔 ----
  //
  // 為什麼回報要存快照，而不是每次即時算：
  //   屋主回報最有價值的用途是「上次我跟你說 3 組看完都嫌暗，這次又 2 組」——
  //   要能對照，就必須留下當時的數字。即時重算只會拿到今天的樣子，
  //   而且物件下架、買方刪掉之後，過去那份回報就再也重現不了。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS seller_report (
      id            VARCHAR(64)  NOT NULL,
      seller_id     VARCHAR(64)  NOT NULL,
      listing_id    VARCHAR(64)  NULL,
      period_start  DATETIME     NOT NULL,
      period_end    DATETIME     NOT NULL,
      auto_json     LONGTEXT     NULL,
      manual_json   LONGTEXT     NULL,
      summary       LONGTEXT     NULL,
      suggestion    LONGTEXT     NULL,
      sent_at       DATETIME     NULL,
      sent_channel  VARCHAR(16)  NULL,
      created_by    VARCHAR(160) NULL,
      created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY srep_seller_idx (seller_id, period_end),
      KEY srep_listing_idx (listing_id, period_end)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 後補欄位 ----
  // CREATE TABLE IF NOT EXISTS 對「表已經存在」的正式站毫無作用，
  // 所以動到既有表的一律走 ensureColumn（沿用 buyer-schema.ts 的做法與理由）。
  //
  // listing.seller_id：物件是誰的。沒有這一欄，回報表就不知道要撈哪些帶看紀錄。
  await ensureColumn("listing", "seller_id", "VARCHAR(64) NULL");
  await ensureColumn("listing", "listed_at", "DATE NULL");
}

/**
 * 補欄位（存在就跳過）。
 * 先查 information_schema 而不是直接 ALTER 吞錯 —— 吞錯會把真正的失敗
 * （型別不合、權限不足）一起吃掉，變成查不出來的資料遺失。
 */
async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const rows = await db.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  );
  const n = Number(rows[0]?.n ?? 0);
  if (n > 0) return;
  await db.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
