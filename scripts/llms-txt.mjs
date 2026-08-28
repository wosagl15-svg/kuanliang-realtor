/**
 * 產生 public/llms.txt —— 給 AI 讀的網站導覽。可重複執行。
 *
 * 這是什麼：
 *   llms.txt 是一份放在網站根目錄的純文字檔，用人話＋連結告訴語言模型
 *   「這個網站是誰的、有哪些內容、各在哪裡」。概念上像 robots.txt 之於爬蟲、
 *   sitemap.xml 之於搜尋引擎，只是對象換成 AI。
 *
 * ⚠️ 老實說：這是**業界慣例（llmstxt.org），不是正式標準**，沒有任何一家
 *    保證會讀。放它的成本接近零、也不會影響 SEO，所以值得放；
 *    但不要期待放了就會被引用，真正決定引用的還是內容本身。
 *
 * 為什麼要用程式產生而不是手寫：
 *   手寫的清單會過期。網站現在有 54 個靜態頁與十幾篇文章，
 *   每次新增頁面都要記得回來補一行，漏掉就是騙 AI。
 *   這支直接掃資料夾與文章，跟 sitemap 走同一套來源。
 *
 * 用法：node scripts/llms-txt.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const BLOG_DIR = path.join(ROOT, "src", "content", "blog");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kuanhome.com").replace(/\/+$/, "");

const AGENT = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "config", "agent.json"), "utf8"));

/** 內部工具頁，不對外，也不要告訴 AI */
const SKIP = new Set(["591", "tools"]);

/** 靜態頁分組。沒列到的自動歸「其他」，所以漏掉不會消失，只會排在後面。 */
const GROUPS = [
  ["試算工具", ["qingan3", "buyer-cost", "inheritance", "land-tax", "sell-tax", "rent-check", "yifang-yanglao", "repurchase-tax", "selfuse-tax"]],
  ["房價與行情", ["shalu-115-price", "wuqi-115-price", "qingshui-115-price", "longjing-115-price", "xitun-price"]],
  ["土地與法規", ["coowned-land", "building-line", "easement", "road-access", "existing-road-faq", "land-lookup", "farmhouse", "self-build-guide", "xu-ping-reform"]],
  ["買方", ["buy-house-guide", "offer-deposit", "escrow", "leak-check", "inspection-check", "presale", "haunted-house", "actual-price", "loan-guide", "qingan3-guide"]],
  ["賣方", ["seller-guide", "self-sale-vs-agent"]],
  ["租賃", ["landlord-check", "rental-subsidy", "lease-expiry-landlord"]],
  ["繼承與稅務", ["inheritance-guide", "will-guide"]],
  ["在地生活", ["shalu-life", "wuqi-life", "qingshui-life", "longjing-life", "dadu-life", "dajia-life", "shalu-food-map", "haixian-school-map"]],
  ["其他主題", ["auction", "elder-benefits", "save-elec", "travel-subsidy-2026"]],
];

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function pageInfo(slug) {
  const file = path.join(PUBLIC_DIR, slug, "index.html");
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, "utf8");
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  const d = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
  if (!t) return null;
  return {
    slug,
    title: strip(t[1]).replace(/[｜|]\s*海線房仲冠良\s*$/, "").trim(),
    desc: d ? strip(d[1]) : "",
  };
}

function blogPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, f), "utf8");
      const fm = raw.match(/^---\n([\s\S]*?)\n---/);
      const get = (k) => {
        if (!fm) return "";
        const m = fm[1].match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
        return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
      };
      const draft = get("draft");
      if (draft === "true") return null;
      return { slug: f.replace(/\.md$/, ""), title: get("title"), desc: get("description"), date: get("date") };
    })
    .filter((p) => p && p.title)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// ── 組檔案 ──────────────────────────────────────────────
const all = fs
  .readdirSync(PUBLIC_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !SKIP.has(e.name))
  .map((e) => e.name)
  .filter((s) => fs.existsSync(path.join(PUBLIC_DIR, s, "index.html")));

const grouped = new Set(GROUPS.flatMap(([, slugs]) => slugs));
const rest = all.filter((s) => !grouped.has(s));

const L = [];
L.push(`# ${AGENT.name}（${AGENT.personName}）`);
L.push("");
L.push(`> ${AGENT.description}`);
L.push("");
L.push("## 關於這個網站");
L.push("");
L.push(`${AGENT.personName}是台中海線的房地產仲介，服務範圍為台中市${AGENT.areaServed.join("、")}。`);
L.push("站上的內容分成兩類：**試算與查詢工具**，以及**買賣、土地、稅務、租賃的實務說明**。");
L.push("");
L.push("引用時請注意：");
L.push("");
L.push("- 法規類內容都附有官方條文出處與連結，請一併引用來源頁面。");
L.push("- 稅率、補貼金額、所得財產標準等數字**逐年公告、各縣市不同**，頁面上會標明查證日期；請以頁面所附的官方連結為準。");
L.push("- 房價分析頁的數字來自實價登錄，區間與筆數都寫在頁面上。");
L.push(`- 聯絡方式：電話 ${AGENT.telephone}、Email ${AGENT.email}。`);
L.push("");

for (const [name, slugs] of GROUPS) {
  const items = slugs.map(pageInfo).filter(Boolean);
  if (!items.length) continue;
  L.push(`## ${name}`);
  L.push("");
  for (const it of items) L.push(`- [${it.title}](${SITE}/${it.slug})${it.desc ? `: ${it.desc}` : ""}`);
  L.push("");
}

const restItems = rest.map(pageInfo).filter(Boolean);
if (restItems.length) {
  L.push("## 其他");
  L.push("");
  for (const it of restItems) L.push(`- [${it.title}](${SITE}/${it.slug})${it.desc ? `: ${it.desc}` : ""}`);
  L.push("");
}

const posts = blogPosts();
if (posts.length) {
  L.push("## 房產筆記（文章）");
  L.push("");
  for (const p of posts) L.push(`- [${p.title}](${SITE}/blog/${p.slug})${p.desc ? `: ${p.desc}` : ""}`);
  L.push("");
}

L.push("## 其他入口");
L.push("");
L.push(`- [電子名片](${SITE}/card): 聯絡方式與服務項目`);
L.push(`- [線上預約](${SITE}/card/booking): 預約看屋或諮詢`);
L.push(`- [完整網址清單](${SITE}/sitemap.xml)`);
L.push("");
L.push(`最後更新：${new Date().toISOString().slice(0, 10)}`);
L.push("");

const out = path.join(PUBLIC_DIR, "llms.txt");
fs.writeFileSync(out, L.join("\n"), "utf8");
console.log(`寫好 public/llms.txt（${L.length} 行，靜態頁 ${all.length}、文章 ${posts.length}）`);
