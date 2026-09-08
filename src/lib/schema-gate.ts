/**
 * 建表閘門 —— 別再每次冷啟動都把 DDL 重播一遍（2026-08-22）
 *
 * 🔴 問題是量出來的，不是猜的：
 *   這個專案的慣例是「第一次用到時 CREATE TABLE IF NOT EXISTS」。
 *   本機沒事（MySQL 在同一台，一次 1ms），但正式站的 TiDB Cloud 在東京，
 *   實測 **一句 `CREATE TABLE IF NOT EXISTS` 就算表早就存在也要 327ms**
 *   （information_schema 查詢 156ms、普通 SELECT 86ms、建立連線 3.5 秒）。
 *
 *   而 ensureAppointmentTable 有 30 句、ensureBuyerTables 16 句、ensureSellerTables 7 句。
 *   /admin/today 三個都會碰到 → **53 × 300ms ≈ 16 秒**，而且 Vercel 的
 *   serverless 實例常常被回收，等於三不五時就重來一次。使用者感受到的就是「開得很慢」。
 *
 * ✅ 解法：在資料庫記一個版本號。開頁面時先花一次 SELECT（86ms）問「建到第幾版了」，
 *   版本夠新就整包跳過。53 句變 1 句。
 *
 * ⚠️⚠️ **加新表、加新欄位時，一定要把對應的 version 數字 +1** ⚠️⚠️
 *   忘了 +1 的後果：本機看起來正常（本機資料庫是新的、版本號還沒寫進去），
 *   但正式站因為版本號已經是最新，會直接跳過你新加的那段 DDL，
 *   然後在查詢時噴 `Unknown column`。這是這個檔唯一的陷阱，改 schema 時務必記得。
 */
import { db } from "@/lib/db";

const GATE_TABLE = "schema_version";

/**
 * 讀目前版本。
 * 回 -1 代表「連版本表都還沒有」（全新的資料庫），跟「有表但版本是 0」要分得開 ——
 * 前者要順便把版本表建起來，後者不用。
 */
async function readVersion(name: string): Promise<number> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ version: number | bigint }>>(
      `SELECT version FROM ${GATE_TABLE} WHERE name = ? LIMIT 1`,
      name,
    );
    return rows[0] ? Number(rows[0].version) : 0;
  } catch {
    // 表不存在 → 查詢會拋錯。這裡不去 information_schema 確認，
    // 因為那又是一次 156ms，而這條路徑一輩子只會走到一次。
    return -1;
  }
}

async function ensureGateTable(): Promise<void> {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${GATE_TABLE} (
      name       VARCHAR(64) NOT NULL,
      version    INT         NOT NULL DEFAULT 0,
      updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * 版本不夠新才跑 migrate()，跑完把版本寫回去。
 *
 * 不用交易包起來：TiDB 的 DDL 本來就不進交易，包了也沒有原子性。
 * 中途失敗的話版本號不會被寫上去，下次進來會整段重跑 —— 而每一句都是
 * `IF NOT EXISTS` / 先查再 ALTER，重跑安全，這就是這裡要的收斂行為。
 */
export async function schemaGate(name: string, version: number, migrate: () => Promise<void>): Promise<void> {
  const current = await readVersion(name);
  if (current >= version) return;

  await migrate();

  if (current === -1) await ensureGateTable();
  await db.$executeRawUnsafe(
    `INSERT INTO ${GATE_TABLE} (name, version) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE version = VALUES(version)`,
    name,
    version,
  );
}
