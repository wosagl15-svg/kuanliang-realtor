/**
 * 買方資料庫 — 建表（2026-08-12）
 *
 * 🚨 全 additive：新表，不改 appointment 或任何既有表 / 邏輯。
 *
 * 沿用專案慣例：不進 prisma schema，第一次用到時自己 CREATE TABLE IF NOT EXISTS
 * （跟 appointment_config / appointment_outbox / appointment_slot_lock 一樣），
 * 所以不需要跑 db:push，開頁面就會自己建好。
 *
 * TiDB 注意事項（沿用 appointment.ts 踩過的坑）：
 *   - 不用 STORED 生成欄（TiDB 不支援 ALTER TABLE 加，會靜默失效）
 *   - JSON 一律存 LONGTEXT，程式端 parse（避免 TiDB JSON 函式相容性問題）
 */
import { db } from "@/lib/db";
import { SEED_TAGS } from "@/lib/buyer-constants";

let ensured = false;

export async function ensureBuyerTables(): Promise<void> {
  if (ensured) return;

  // ---- 買方主檔 ----
  // phone_norm 唯一鍵 = 撞單／重複建檔的防線。允許 '' （少數只有 LINE 沒電話的），
  // 但 '' 不能唯一，所以用一般索引 + 程式端檢查（見 buyer.ts findByPhone）。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer (
      id                 VARCHAR(64)  NOT NULL,
      name               VARCHAR(80)  NOT NULL DEFAULT '',
      phone_norm         VARCHAR(20)  NOT NULL DEFAULT '',
      phone_raw          VARCHAR(60)  NULL,
      line_user_id       VARCHAR(120) NULL,
      email              VARCHAR(160) NULL,
      source             VARCHAR(24)  NOT NULL DEFAULT 'manual',
      stage              VARCHAR(16)  NOT NULL DEFAULT 'new',
      property_type      VARCHAR(16)  NOT NULL DEFAULT 'house',
      owner_email        VARCHAR(160) NULL,
      completeness_pct   INT          NOT NULL DEFAULT 0,
      grade              VARCHAR(2)   NOT NULL DEFAULT 'D',
      heat_score         INT          NOT NULL DEFAULT 0,
      personality_note   LONGTEXT     NULL,
      decision_maker     VARCHAR(120) NULL,
      funding_note       LONGTEXT     NULL,
      urgency            VARCHAR(16)  NULL,
      broadcast_opt_out  TINYINT(1)   NOT NULL DEFAULT 0,
      last_contact_at    DATETIME     NULL,
      created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at         TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY buyer_phone_idx (phone_norm),
      KEY buyer_stage_idx (stage, last_contact_at),
      KEY buyer_grade_idx (grade, completeness_pct),
      KEY buyer_name_idx (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 需求版本 ----
  // 為什麼要版本：三個月前說 1800 萬、上個月改口 2200。只存一個值，
  // 自動配對會一直拿舊需求去比對，比出一堆錯的，用兩次就沒人信。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_requirement (
      id              VARCHAR(64)  NOT NULL,
      buyer_id        VARCHAR(64)  NOT NULL,
      is_current      TINYINT(1)   NOT NULL DEFAULT 1,
      budget_min      INT          NULL,
      budget_max      INT          NULL,
      budget_flex_pct INT          NOT NULL DEFAULT 0,
      districts       LONGTEXT     NULL,
      room_min        INT          NULL,
      elevator        VARCHAR(16)  NOT NULL DEFAULT 'any',
      parking         VARCHAR(16)  NOT NULL DEFAULT 'any',
      purpose         VARCHAR(16)  NOT NULL DEFAULT 'unknown',
      size_min        DECIMAL(6,2) NULL,
      size_max        DECIMAL(6,2) NULL,
      age_max         INT          NULL,
      floor_pref      VARCHAR(60)  NULL,
      soft_json       LONGTEXT     NULL,
      raw_source_text LONGTEXT     NULL,
      extraction_meta LONGTEXT     NULL,
      created_by      VARCHAR(160) NULL,
      created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY breq_buyer_idx (buyer_id, is_current, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 社區主檔 ----
  // 🔴 地基一：社區必須是主檔，不是文字欄位。
  // 自由輸入會長出「太子哈佛／哈佛／哈佛大苑／太子哈佛B棟」四個社區，
  // 「輸入社區撈出所有想買的人」就永遠做不出來。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community (
      id            VARCHAR(64)  NOT NULL,
      name          VARCHAR(120) NOT NULL,
      aliases       LONGTEXT     NULL,
      district      VARCHAR(24)  NOT NULL DEFAULT '',
      address       VARCHAR(255) NULL,
      has_elevator  TINYINT(1)   NULL,
      parking_type  VARCHAR(40)  NULL,
      built_year    INT          NULL,
      total_units   INT          NULL,
      walk_min_hsr  INT          NULL,
      walk_min_train INT         NULL,
      school_zone   VARCHAR(255) NULL,
      note          LONGTEXT     NULL,
      is_demo       TINYINT(1)   NOT NULL DEFAULT 0,
      created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY community_district_idx (district),
      KEY community_name_idx (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 買方指定社區（多對多）
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_community (
      buyer_id     VARCHAR(64) NOT NULL,
      community_id VARCHAR(64) NOT NULL,
      created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (buyer_id, community_id),
      KEY bc_community_idx (community_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 標籤（兩層）----
  // is_controlled=1 受控標籤：只能選不能打字，參與配對與統計
  // is_controlled=0 自由標籤：愛打什麼打什麼，只做人腦備註，不參與自動配對
  // 沒有這兩層，半年後會有「近捷運／捷運近／離捷運近／捷運宅」四個同義標籤，篩選就廢了。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_tag_def (
      id            VARCHAR(64)  NOT NULL,
      name          VARCHAR(60)  NOT NULL,
      category      VARCHAR(24)  NOT NULL DEFAULT 'special',
      is_controlled TINYINT(1)   NOT NULL DEFAULT 1,
      use_count     INT          NOT NULL DEFAULT 0,
      created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY tagdef_name_uk (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_tag (
      buyer_id   VARCHAR(64) NOT NULL,
      tag_id     VARCHAR(64) NOT NULL,
      created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (buyer_id, tag_id),
      KEY btag_tag_idx (tag_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 互動紀錄 ----
  // 這張表撐起兩件事：① 互動熱度（分級第二軸）② 嘴巴 vs 行為的落差
  //   「他登記要三房，但看的 5 間有 4 間是兩房 → 真實需求可能是總價，不是房數」
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_contact_log (
      id           VARCHAR(64)  NOT NULL,
      buyer_id     VARCHAR(64)  NOT NULL,
      type         VARCHAR(16)  NOT NULL DEFAULT 'note',
      content      LONGTEXT     NULL,
      community_id VARCHAR(64)  NULL,
      listing_id   VARCHAR(64)  NULL,
      reaction     VARCHAR(24)  NULL,
      occurred_at  DATETIME     NOT NULL,
      created_by   VARCHAR(160) NULL,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY blog_buyer_idx (buyer_id, occurred_at),
      KEY blog_type_idx (type, occurred_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 物件庫（配案用；第一版可先塞示範資料）----
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS listing (
      id            VARCHAR(64)  NOT NULL,
      title         VARCHAR(160) NOT NULL,
      community_id  VARCHAR(64)  NULL,
      district      VARCHAR(24)  NOT NULL DEFAULT '',
      address       VARCHAR(255) NULL,
      price         INT          NULL,
      size_ping     DECIMAL(6,2) NULL,
      rooms         INT          NULL,
      living_rooms  INT          NULL,
      baths         INT          NULL,
      floor_no      INT          NULL,
      total_floors  INT          NULL,
      age_year      INT          NULL,
      has_elevator  TINYINT(1)   NULL,
      parking_count INT          NOT NULL DEFAULT 0,
      property_type VARCHAR(16)  NOT NULL DEFAULT 'house',
      status        VARCHAR(16)  NOT NULL DEFAULT 'onsale',
      tags_json     LONGTEXT     NULL,
      note          LONGTEXT     NULL,
      is_demo       TINYINT(1)   NOT NULL DEFAULT 0,
      created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY listing_status_idx (status, district),
      KEY listing_community_idx (community_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 推播批次 ----
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_broadcast (
      id          VARCHAR(64)  NOT NULL,
      title       VARCHAR(160) NOT NULL DEFAULT '',
      listing_id  VARCHAR(64)  NULL,
      template    LONGTEXT     NULL,
      filter_json LONGTEXT     NULL,
      created_by  VARCHAR(160) NULL,
      created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY bcast_created_idx (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // click_token 唯一 → 點擊回寫的依據。沒有這張表，你永遠不知道哪次群發有效。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_broadcast_target (
      id           VARCHAR(64)  NOT NULL,
      broadcast_id VARCHAR(64)  NOT NULL,
      buyer_id     VARCHAR(64)  NOT NULL,
      channel      VARCHAR(16)  NOT NULL DEFAULT 'manual',
      message      LONGTEXT     NULL,
      click_token  VARCHAR(64)  NOT NULL,
      sent_at      DATETIME     NULL,
      clicked_at   DATETIME     NULL,
      send_error   VARCHAR(255) NULL,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY bt_token_uk (click_token),
      KEY bt_broadcast_idx (broadcast_id),
      KEY bt_buyer_idx (buyer_id, sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ---- 匯出稽核 ----
  // 系統擁有者拍板：第一版不分權限是為了速度，但匯出全庫一定要留紀錄。
  // 系統越好用，將來被整包帶走的損失越大。
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS buyer_export_log (
      id         VARCHAR(64)  NOT NULL,
      actor      VARCHAR(160) NOT NULL DEFAULT '',
      row_count  INT          NOT NULL DEFAULT 0,
      scope      VARCHAR(255) NULL,
      ip         VARCHAR(64)  NULL,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY bexport_actor_idx (actor, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await seedTags();
  ensured = true;
}

/** 首次建表塞受控標籤種子。已存在就跳過（用 INSERT IGNORE，重跑安全）。 */
async function seedTags(): Promise<void> {
  const rows = await db.$queryRawUnsafe<{ c: bigint | number }[]>(
    `SELECT COUNT(*) AS c FROM buyer_tag_def`,
  );
  const count = Number(rows[0]?.c ?? 0);
  if (count > 0) return;

  for (const t of SEED_TAGS) {
    await db.$executeRawUnsafe(
      `INSERT IGNORE INTO buyer_tag_def (id, name, category, is_controlled) VALUES (?, ?, ?, 1)`,
      `tag_${slug(t.name)}`,
      t.name,
      t.category,
    );
  }
}

function slug(s: string): string {
  // 中文標籤名不能當 id，用簡單 hash 保證穩定且不撞
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
