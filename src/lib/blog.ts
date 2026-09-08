import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

/**
 * 網誌：文章就是 src/content/blog/ 底下的 Markdown 檔。
 *
 * 為什麼用檔案不用資料庫：文章要進 git（改壞可以還原）、要能被 sitemap 掃到、
 * 而且冠良自己用記事本就能改。多一個資料庫只是多一個會壞的東西。
 *
 * 網址是 /blog/<檔名>，不帶日期。日期式網址（/2026/08/…）會讓讀者一眼覺得
 * 「這是舊文」，但房產知識大多是長青內容，不該被日期扣分。
 */

export const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");

/** 分類。key 進網址，所以用英文。 */
export const CATEGORIES = {
  knowledge: { name: "房產知識", icon: "🏠", desc: "稅務、貸款、產權、法規，白話拆給你聽。" },
  market: { name: "市場觀察", icon: "📊", desc: "實價登錄與成交數據，只講查得到的數字。" },
  local: { name: "海線在地", icon: "📍", desc: "沙鹿、清水、梧棲、龍井、大肚、大甲、外埔的生活與行情。" },
  case: { name: "成交現場", icon: "💬", desc: "真實案件裡學到的事。" },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export type Post = {
  slug: string;
  title: string;
  description: string;
  category: CategoryKey;
  date: string;
  updated?: string;
  /** 卡片上的大圖示；沒有縮圖時用它撐版面 */
  emoji: string;
  tags: string[];
  /** 站內相關頁面（例如 /loan-guide），用來把文章串進既有的主題群集 */
  related: string[];
  draft: boolean;
  /** YouTube 影片 ID（不是整串網址）。有填就會嵌入影片。 */
  youtube?: string;
  /** Shorts 是直式 9:16，一般影片是橫式 16:9 */
  youtubeVertical: boolean;
  /**
   * 影片要放文章「後面」而不是開頭。
   *
   * 預設 false（開頭）—— 既有文章的版面不會因為這個欄位而改變。
   * 內容偏工具型、讀者是來查資料的那種文章，把影片壓到後面，
   * 開頭直接進重點；VideoObject 結構化資料照樣保留。
   */
  youtubeAtEnd: boolean;
  /** 影片上架日。VideoObject 需要，沒填就用文章日期。 */
  videoDate?: string;
  /**
   * 頁首導覽圖。手機讀者不會從頭讀到尾——先給他一張「三秒看懂」的圖，
   * 願意往下才進正文，法條放最後面。沒填就不顯示。
   */
  nav: NavStep[];
  /** 導覽圖上方的關鍵數字條（日期、金額、名額這種一眼要看到的）。 */
  facts: NavFact[];
  /** 圖卡組。一張卡講一件事，排在正文之前。 */
  cards: Card[];
  html: string;
  readingMinutes: number;
};

/** 導覽圖的一格。`to` 填「章節標題的文字」，不是自己編的 id。 */
export type NavStep = { step: string; title: string; desc: string; to?: string };
export type NavFact = { k: string; v: string };

/**
 * 圖卡組（Chibi_Business_Manga_v1）。
 *
 * 🔴 2026-08-29 冠良回饋：只放一張導覽圖不夠，「圖卡要做到能講解清楚，
 *    超過一張可以」。所以整段解說都用卡片承載，文字段落只留給法條。
 *    一張卡講一件事，看不懂就不會往下。
 */
export type Card =
  | { type: "facts"; items: NavFact[] }
  | { type: "steps"; title?: string; sub?: string; items: NavStep[] }
  | { type: "myth"; title?: string; wrong: string; rights: string[]; punch?: string }
  | { type: "quote"; label?: string; text: string; hl?: string }
  | { type: "warn"; title?: string; lead?: string; items: NavFact[] };

function isCategory(v: unknown): v is CategoryKey {
  return typeof v === "string" && v in CATEGORIES;
}

/**
 * YAML 會把沒加引號的 `date: 2026-08-14` 直接解析成 Date 物件，
 * 硬轉字串會變成「Fri Aug 14 2026 08:00:00 GMT+0800 (台北標準時間)」。
 * 那串會直接印在卡片上，也會讓 JSON-LD 的 datePublished 變成無效格式。
 * 一律正規化成 YYYY-MM-DD。
 */
function toDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : s;
}

/**
 * frontmatter 可以填整串網址也可以只填 ID，這裡統一抽出 ID。
 * 支援 youtu.be/xxx、watch?v=xxx、/shorts/xxx 三種常見形式。
 */
function youtubeId(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const m = s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{6,}$/.test(s) ? s : undefined;
}

/** 中文沒有空格可切，用字數估：一分鐘約 400 字。 */
function readingMinutes(markdown: string): number {
  const chars = markdown.replace(/\s+/g, "").length;
  return Math.max(1, Math.round(chars / 400));
}

/**
 * 章節標題加上 id，讓導覽圖點得進去（順便讓深層連結可用）。
 *
 * 🔴 中文沒有音譯這回事，硬要轉英文只會產生一堆無意義的字串。
 *    這裡直接保留中文字元，瀏覽器與 Google 都吃得下 UTF-8 的錨點。
 *    導覽圖那邊用同一支函式算，所以作者只要寫「標題原文」就好，
 *    章節順序調動也不會斷掉。
 */
export function headingSlug(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
}

/** 把 h2 / h3 補上 id。 */
function addHeadingIds(html: string): string {
  return html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (_m, tag, inner) => {
    const id = headingSlug(inner);
    return id ? `<${tag} id="${id}">${inner}</${tag}>` : `<${tag}>${inner}</${tag}>`;
  });
}

/**
 * 表格在手機上一定塞不下。包一層可橫向捲動的容器，
 * 讓表格自己維持 display:table（欄寬才算得對），由外層負責捲動。
 */
function wrapTables(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, '<div class="tablewrap"><table>$1</table></div>');
}

function parse(file: string): Post | null {
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
  const { data, content } = matter(raw);
  const slug = file.replace(/\.md$/, "");

  if (!data.title || !data.date) return null;

  return {
    slug,
    title: String(data.title),
    description: String(data.description ?? ""),
    category: isCategory(data.category) ? data.category : "knowledge",
    date: toDateString(data.date),
    updated: data.updated ? toDateString(data.updated) : undefined,
    emoji: String(data.emoji ?? CATEGORIES[isCategory(data.category) ? data.category : "knowledge"].icon),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    related: Array.isArray(data.related) ? data.related.map(String) : [],
    // 沒寫 draft 的一律當草稿。寧可漏發，也不要把還沒審過的文字掛上去。
    draft: data.draft !== false,
    youtube: youtubeId(data.youtube),
    youtubeVertical: data.youtubeVertical !== false,
    // 沒寫就是 false（維持原本「影片在開頭」的行為）
    youtubeAtEnd: data.youtubeAtEnd === true,
    nav: Array.isArray(data.nav)
      ? data.nav.map((r: Record<string, unknown>) => ({
          step: String(r?.step ?? ""),
          title: String(r?.title ?? ""),
          desc: String(r?.desc ?? ""),
          to: r?.to ? headingSlug(String(r.to)) : undefined,
        })).filter((r) => r.title)
      : [],
    facts: Array.isArray(data.facts)
      ? data.facts.map((r: Record<string, unknown>) => ({
          k: String(r?.k ?? ""),
          v: String(r?.v ?? ""),
        })).filter((r) => r.v)
      : [],
    // ⚠️ steps 卡的 to: 填的是「章節標題原文」，這裡要轉成錨點 id。
    //    忘了轉的話卡片點下去不會跳（2026-08-29 踩過一次）。
    cards: Array.isArray(data.cards)
      ? (data.cards as Card[])
          .filter((c) => c && c.type)
          .map((c) =>
            c.type === "steps"
              ? { ...c, items: (c.items || []).map((it) => ({ ...it, to: it.to ? headingSlug(it.to) : undefined })) }
              : c,
          )
      : [],
    videoDate: data.videoDate ? toDateString(data.videoDate) : undefined,
    html: wrapTables(addHeadingIds(marked.parse(content, { async: false }) as string)),
    readingMinutes: readingMinutes(content),
  };
}

/** 已發布的文章，新的在前。草稿不會出現在任何列表、sitemap 或網址上。 */
export function getPosts(): Post[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parse)
    .filter((p): p is Post => p !== null && !p.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

export function postsByCategory(key: CategoryKey): Post[] {
  return getPosts().filter((p) => p.category === key);
}

/** 同分類的其他文章，補滿到 n 篇為止（讓每篇文章都連得出去，不變孤島）。 */
export function relatedPosts(post: Post, n = 3): Post[] {
  const all = getPosts().filter((p) => p.slug !== post.slug);
  const same = all.filter((p) => p.category === post.category);
  return [...same, ...all.filter((p) => p.category !== post.category)].slice(0, n);
}
