import fs from "node:fs";
import path from "node:path";

/**
 * 購屋攻略站的內容頁是靜態 HTML，放在 public/<slug>/index.html。
 *
 * 以前 next.config.ts 裡是一份手寫的 40 頁清單，新增一頁要記得同時改
 * rewrite 與 sitemap 兩個地方——漏改的下場是頁面 404 或 Google 收不到。
 * 改成直接掃資料夾，新增一頁只要把 HTML 放進去就自動生效。
 */
/**
 * 內部工具頁：網址要能用（所以照樣產生 rewrite），但**不進 sitemap**。
 *
 * 為什麼要分開處理：這些頁面自己帶了 noindex，如果又出現在 sitemap 裡，
 * Google Search Console 會報「已提交的網址標記為 noindex」的錯誤，
 * 而且會稀釋整站的收錄品質。要新增內部頁就往這裡加一個 slug。
 */
export const UNLISTED_PAGES = new Set<string>(["591", "threads-callback"]);

export function listStaticPages(publicDir?: string): string[] {
  const dir = publicDir ?? path.join(process.cwd(), "public");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(dir, name, "index.html")))
    .sort();
}

/**
 * 取一個靜態頁的顯示名稱：讀它自己 <title> 的第一段（｜之前那段）。
 *
 * 為什麼要有這個：部落格文章的「延伸閱讀」本來只吃一份手寫的 PAGE_NAMES 對照表，
 * 表裡沒有的 slug 會直接把網址原樣印出來（2026-08-22 BOSS 抓到 `/road-access` 就是這樣）。
 * 手維護的清單一定會跟不上新增的頁面，所以改成「表裡沒有就去讀那頁自己的標題」。
 */
const titleCache = new Map<string, string | null>();

export function getStaticPageTitle(slug: string, publicDir?: string): string | null {
  const key = slug.replace(/^\/+|\/+$/g, "");
  if (titleCache.has(key)) return titleCache.get(key) ?? null;

  const dir = publicDir ?? path.join(process.cwd(), "public");
  const file = path.join(dir, key, "index.html");
  let name: string | null = null;
  try {
    // 標題都在檔頭，讀前 8KB 就夠，不必整份載進來
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    const m = /<title>([^<]*)<\/title>/i.exec(buf.subarray(0, n).toString("utf8"));
    if (m) {
      // 「路權與封路攻略｜土地是你的…｜海線房仲冠良」→ 只要第一段
      const first = m[1].split(/[｜|]/)[0].trim();
      if (first) name = first;
    }
  } catch {
    // 檔案不存在或讀不到就回 null，交給呼叫端決定 fallback
  }
  titleCache.set(key, name);
  return name;
}
