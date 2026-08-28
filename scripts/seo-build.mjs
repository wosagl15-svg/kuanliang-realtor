/**
 * 幫 public/ 底下的靜態內容頁補上 SEO 必要標記。可重複執行，不會疊加。
 *
 * 做兩件事：
 *   1. 補文件骨架 —— 房價分析頁是產線輸出的 HTML「片段」，沒有 DOCTYPE / html lang /
 *      head / body。沒有 DOCTYPE 瀏覽器會進 quirks mode，沒有 lang 屬性 Google
 *      判斷不出這是繁體中文頁。
 *   2. 補 canonical + og:url + JSON-LD —— 2026-08-14 實測全站 43 頁一個都沒有。
 *      canonical 是重複內容的解藥（同一篇文章曾同時掛在 netlify 與 vercel 兩個網域），
 *      JSON-LD 則是讓 Google 與 AI 搜尋知道「這篇誰寫的、他是做什麼的」。
 *
 * 用法：npm run seo
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kuanhome.com").replace(/\/+$/, "");

const BEGIN = "<!-- SEO:AUTO 由 scripts/seo-build.mjs 產生，不要手改 -->";
const END = "<!-- /SEO:AUTO -->";

/** 這些頁面不是文章，是彙整頁 */
const HUB_PAGES = new Set(["tools"]);

/**
 * 主題群集：同一條決策路徑上的頁面互相連結。
 *
 * 之前全站是「首頁連出去、內頁連回首頁」的放射狀結構，橫向一條連結都沒有。
 * 對讀者來說，看完建築線想知道路權要自己回首頁再找；
 * 對 Google 來說，看不出這些頁面在講同一件事。
 *
 * 每個群集內部全互連（每頁自動排除自己），一次補完雙向連結。
 */
const CLUSTERS = {
  土地與自地自建: {
    intro: "買地、蓋房子這條路上會遇到的問題，這幾頁是一整組的：",
    pages: [
      ["/land-lookup", "先查這塊地：使用分區與環境限制"],
      ["/building-line", "能不能蓋：申請建築線全攻略"],
      ["/existing-road-faq", "進得去嗎：既成道路常見問題"],
      ["/road-access", "路是誰的：路權與封路攻略"],
      ["/easement", "謄本上的他項權利：地役權（不動產役權）"],
      ["/coowned-land", "地不只你一個人的：土地法第 34 條之 1"],
      ["/farmhouse", "農地能不能蓋：老農配蓋農舍"],
      ["/self-build-guide", "決定要蓋了：自地自建全流程"],
      ["/land-tax", "賣地要繳多少：土地增值稅試算"],
      ["/blog/self-build-cash-flow", "錢夠不夠：買地自建的資金缺口"],
    ],
  },
  賣屋: {
    intro: "準備賣房子，這幾頁一起看：",
    pages: [
      ["/seller-guide", "賣房前你必須知道的事"],
      ["/sell-tax", "賣屋稅費總表：土增稅＋房地合一"],
      ["/selfuse-tax", "房地合一稅・自用優惠 400 萬"],
      ["/repurchase-tax", "換屋重購退稅怎麼用"],
      ["/self-sale-vs-agent", "自售還是找仲介"],
      ["/actual-price", "實價登錄怎麼查才不會被當肥羊"],
    ],
  },
  買屋: {
    intro: "買房子這條路上的每一關：",
    pages: [
      ["/buy-house-guide", "買屋注意事項全攻略"],
      ["/buyer-cost", "買方購屋成本試算"],
      ["/qingan3", "青安 3.0 月付試算機"],
      ["/loan-guide", "貸款成數與寬限期怎麼看"],
      ["/offer-deposit", "斡旋金 vs 要約書"],
      ["/escrow", "履約保證是什麼"],
      ["/leak-check", "漏水屋況檢查清單"],
      ["/inspection-check", "中古屋交屋驗屋清單"],
    ],
  },
  海線在地: {
    intro: "想知道住在哪一區比較適合你：",
    pages: [
      ["/shalu-life", "沙鹿在地生活指南"],
      ["/qingshui-life", "清水在地生活指南"],
      ["/wuqi-life", "梧棲在地生活指南"],
      ["/longjing-life", "龍井在地生活指南"],
      ["/dadu-life", "大肚在地生活指南"],
      ["/dajia-life", "大甲在地生活指南"],
      ["/shalu-115-price", "沙鹿 115 年成交分析"],
      ["/qingshui-115-price", "清水 115 年成交分析"],
      ["/wuqi-115-price", "梧棲 115 年成交分析"],
      ["/longjing-115-price", "龍井 115 年成交分析"],
      ["/haixian-school-map", "海線學區地圖"],
      ["/shalu-food-map", "靜宜大學美食地圖"],
    ],
  },
  租屋: {
    intro: "租屋這條線的三頁，租之前一起看：",
    pages: [
      ["/rent-check", "這個租金貴得有道理嗎：租屋比價工具"],
      ["/rental-subsidy", "房客要報租金補貼，房東該答應嗎"],
      ["/landlord-check", "房東出租檢查表"],
    ],
  },
  繼承與傳承: {
    intro: "家裡的房子要交給下一代，這幾頁一起看：",
    pages: [
      ["/inheritance", "繼承・贈與稅試算器"],
      ["/inheritance-guide", "繼承流程完整指南"],
      ["/will-guide", "遺囑怎麼寫才有效"],
      ["/coowned-land", "共有土地怎麼處理"],
      ["/yifang-yanglao", "以房養老怎麼算"],
      ["/elder-benefits", "長輩福利地圖"],
    ],
  },
};

/* 評論引導區塊由 scripts/review-cta.mjs 產生，這裡只需要認得它的標記，好把它排除在 FAQ 之外 */
const REVIEW_BEGIN = "<!-- REVIEW:AUTO 由 scripts/review-cta.mjs 產生，不要手改 -->";
const REVIEW_END = "<!-- /REVIEW:AUTO -->";

const CLUSTER_BEGIN = "<!-- CLUSTER:AUTO 由 scripts/seo-build.mjs 產生，不要手改 -->";
const CLUSTER_END = "<!-- /CLUSTER:AUTO -->";

/** slug -> 該頁所屬的群集區塊 HTML（已排除自己） */
function buildClusterBlocks() {
  const bySlug = new Map();
  for (const [name, { intro, pages }] of Object.entries(CLUSTERS)) {
    for (const [href] of pages) {
      const slug = href.replace(/^\//, "");
      if (slug.startsWith("blog/")) continue; // 網誌頁由 Next 自己渲染，不注入
      const others = pages.filter(([h]) => h !== href);
      const items = others
        .map(([h, label]) => `<li><a href="${h}">${label}</a></li>`)
        .join("");
      bySlug.set(
        slug,
        `${CLUSTER_BEGIN}
<section class="seo-cluster">
<h2>${name}・延伸閱讀</h2>
<p>${intro}</p>
<ul>${items}</ul>
</section>
<style>
.seo-cluster{max-width:820px;margin:34px auto 40px;padding:24px;background:#fff;
 border:1px solid #ddd2bd;border-radius:16px;
 font-family:"Noto Sans TC",system-ui,-apple-system,"Microsoft JhengHei",sans-serif}
.seo-cluster h2{font-size:20px;color:#16283f;margin:0 0 8px;line-height:1.4}
.seo-cluster p{font-size:15px;color:#6f6a60;margin:0 0 14px;line-height:1.7}
.seo-cluster ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.seo-cluster a{display:flex;align-items:center;min-height:44px;padding:8px 14px;
 background:#f7f3ea;border:1px solid #ddd2bd;border-radius:10px;
 color:#16283f;text-decoration:none;font-size:15.5px;line-height:1.5}
.seo-cluster a:hover{border-color:#c8963e}
@media(max-width:520px){.seo-cluster{margin:24px 16px 32px;padding:18px}}
</style>
${CLUSTER_END}`,
      );
    }
  }
  return bySlug;
}

const CLUSTER_BLOCKS = buildClusterBlocks();

/**
 * 商家資料的唯一來源是 src/config/agent.json —— 首頁的 JSON-LD 也讀同一份。
 * 電話、地址、座標、社群連結只要改那個檔，43 頁靜態頁與首頁會一起更新。
 */
const AGENT = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src", "config", "agent.json"), "utf8"),
);
const AGENT_ID = `${SITE}/#agent`;
const PERSON_ID = `${SITE}/#wuguanliang`;

/** 把片段補成完整 HTML 文件。已經是完整文件就原樣返回。 */
function ensureDocumentSkeleton(html) {
  if (/^\s*<!DOCTYPE/i.test(html)) return html;

  // 產線模板的 head/body 交界固定在 </style> 之後的第一個 <header>。
  // ⚠️ 產線在 Windows 上輸出的是 CRLF，所以換行不能寫死成 \n。
  const seam = /<\/style>\s*<header>/i;
  if (!seam.test(html)) {
    console.warn("  ⚠ 找不到 head/body 交界，跳過骨架補丁");
    return html;
  }

  const withSeam = html.replace(seam, "</style>\n</head>\n<body>\n<header>");
  return `<!DOCTYPE html>\n<html lang="zh-Hant">\n<head>\n${withSeam}\n</body>\n</html>\n`;
}

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function stripTags(s) {
  return s
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 從頁面「已經看得見的」問答內容抽出 FAQ。
 *
 * 只抓標題本身就是問句（結尾是 ？）的段落，答案取該段到下一個標題之間的文字。
 * 刻意不做「幫沒有問答的頁面生一份 FAQ」這種事——schema 是描述頁面已有的內容，
 * 拿它去宣告不存在的東西，被抓到會整站失去信任。
 *
 * ⚠️ 期待值要正確：Google 在 2023 年已把 FAQ 的搜尋結果展示限縮到政府與醫療類網站，
 * 一般網站加了不會多出版面。這裡做的目的是讓「答案引擎與 AI」更容易取用，
 * 不是為了 Google 的星星。
 */
function extractFaq(html) {
  const body = html.slice(Math.max(0, html.search(/<body/i)));
  const clean = body
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // 主題群集區塊的標題不是問答，排除掉
    .replace(new RegExp(`${CLUSTER_BEGIN}[\\s\\S]*?${CLUSTER_END}`, "g"), " ")
    /* 🔴 2026-08-28：Google 評論引導區塊的標題是「這些整理，有幫到你嗎？」，問號結尾，
       被當成 FAQ 抓進結構化資料——而那個區塊全站 54 頁都有。實測 14 個有 FAQPage
       的頁面全部被污染，其中 8 頁還是靠這一題才湊到三題門檻。
       CTA 區塊同理（「還是乾脆賣掉？」），行銷用語不是問答內容。 */
    .replace(new RegExp(`${REVIEW_BEGIN}[\\s\\S]*?${REVIEW_END}`, "g"), " ")
    .replace(/<(div|section)[^>]*class=["'][^"']*\bcta\b[^"']*["'][\s\S]*?<\/\1>/gi, " ");

  const headings = [...clean.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const faq = [];

  for (let i = 0; i < headings.length; i += 1) {
    const q = stripTags(headings[i][2]);
    if (!/[？?]\s*$/.test(q) || q.length < 6 || q.length > 120) continue;

    const start = headings[i].index + headings[i][0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index : Math.min(start + 4000, clean.length);
    const a = stripTags(clean.slice(start, end)).slice(0, 320);
    if (a.length < 30) continue;

    faq.push({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    });
  }
  // 少於三題不值得標記，那通常只是內文剛好用了問句當小標
  return faq.length >= 3 ? faq.slice(0, 10) : [];
}

/** 去掉標題結尾的品牌後綴，留下真正的主題當 headline */
function toHeadline(title) {
  return title.replace(/[｜|]\s*海線房仲冠良\s*$/, "").trim() || title;
}

function buildJsonLd({ slug, url, title, description, modified, faq }) {
  // ⚠️ 這個節點的形狀要與 src/app/page.tsx 的 JSON_LD 一致（兩邊共用同一份 agent.json）。
  const agent = {
    "@type": "RealEstateAgent",
    "@id": AGENT_ID,
    name: AGENT.name,
    alternateName: AGENT.alternateName,
    description: AGENT.description,
    slogan: AGENT.slogan,
    url: `${SITE}/`,
    image: `${SITE}${AGENT.imagePath}`,
    telephone: AGENT.telephone,
    email: AGENT.email,
    address: AGENT.address,
    geo: AGENT.geo,
    priceRange: AGENT.priceRange,
    areaServed: AGENT.areaServed.map((n) => ({ "@type": "AdministrativeArea", name: `台中市${n}` })),
    sameAs: AGENT.sameAs,
    hasMap: AGENT.hasMap,
    employee: {
      "@type": "Person",
      "@id": PERSON_ID,
      name: AGENT.personName,
      jobTitle: AGENT.jobTitle,
    },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首頁", item: `${SITE}/` },
      ...(slug === "tools"
        ? []
        : [{ "@type": "ListItem", position: 2, name: "購屋攻略", item: `${SITE}/tools` }]),
      {
        "@type": "ListItem",
        position: slug === "tools" ? 2 : 3,
        name: toHeadline(title),
        item: url,
      },
    ],
  };

  const main = HUB_PAGES.has(slug)
    ? {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: toHeadline(title),
        description,
        url,
        inLanguage: "zh-Hant-TW",
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": AGENT_ID },
      }
    : {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: toHeadline(title),
        description,
        url,
        inLanguage: "zh-Hant-TW",
        dateModified: modified,
        author: { "@id": PERSON_ID },
        publisher: { "@id": AGENT_ID },
        mainEntityOfPage: { "@id": url },
      };

  const graph = [main, agent, breadcrumb];
  if (faq && faq.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faq,
      isPartOf: { "@id": `${url}#article` },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function buildBlock(info) {
  const jsonLd = JSON.stringify(buildJsonLd(info)).replace(/</g, "\\u003c");
  return [
    BEGIN,
    `<link rel="canonical" href="${info.url}">`,
    `<meta property="og:url" content="${info.url}">`,
    `<meta property="og:site_name" content="${AGENT.name}">`,
    `<meta property="og:locale" content="zh_TW">`,
    `<script type="application/ld+json">${jsonLd}</script>`,
    END,
  ].join("\n");
}

function processPage(slug) {
  const file = path.join(PUBLIC_DIR, slug, "index.html");
  const original = fs.readFileSync(file, "utf8");

  let html = ensureDocumentSkeleton(original);

  // 先清掉舊的注入區塊，才能重複執行而不疊加
  html = html.replace(
    new RegExp(`\\n?${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END}\\n?`, "g"),
    "\n",
  );

  // 主題群集區塊同樣要先清掉舊的，腳本才能重複執行
  html = html.replace(
    new RegExp(
      `\\n?${CLUSTER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${CLUSTER_END}\\n?`,
      "g",
    ),
    "\n",
  );

  // 舊版手寫的 RealEstateAgent 區塊（散在個別頁面裡、沒有 @id）現在由這支腳本統一產生。
  // 留著會變成同一頁出現兩個沒有關聯的商家實體，Google 可能當成兩間公司。
  let legacyRemoved = 0;
  html = html.replace(
    /\s*<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi,
    (match, body) => {
      if (!/"@type"\s*:\s*"RealEstateAgent"/.test(body)) return match;
      legacyRemoved += 1;
      return "";
    },
  );

  const title = extract(html, /<title>([\s\S]*?)<\/title>/i);
  const description = extract(html, /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
  if (!title) {
    console.warn(`  ⚠ ${slug}：抓不到 <title>，跳過`);
    return { slug, ok: false };
  }

  const info = {
    slug,
    url: `${SITE}/${slug}`,
    title,
    description,
    modified: fs.statSync(file).mtime.toISOString(),
    faq: extractFaq(html),
  };

  const closeHead = html.search(/<\/head>/i);
  if (closeHead === -1) {
    console.warn(`  ⚠ ${slug}：找不到 </head>，跳過`);
    return { slug, ok: false };
  }

  html = html.slice(0, closeHead) + buildBlock(info) + "\n" + html.slice(closeHead);

  // 主題群集：放在 </body> 前，讀者看完內文剛好接到同一條路上的下一頁
  const cluster = CLUSTER_BLOCKS.get(slug);
  let clustered = false;
  if (cluster) {
    const closeBody = html.search(/<\/body>/i);
    if (closeBody !== -1) {
      html = html.slice(0, closeBody) + cluster + "\n" + html.slice(closeBody);
      clustered = true;
    } else {
      html += "\n" + cluster + "\n";
      clustered = true;
    }
  }

  fs.writeFileSync(file, html, "utf8");
  return {
    slug,
    ok: true,
    skeleton: !/^\s*<!DOCTYPE/i.test(original),
    legacyRemoved,
    clustered,
    faqCount: info.faq.length,
  };
}

const slugs = fs
  .readdirSync(PUBLIC_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => fs.existsSync(path.join(PUBLIC_DIR, n, "index.html")))
  .sort();

console.log(`網址基準：${SITE}`);
console.log(`掃到 ${slugs.length} 頁靜態內容頁\n`);

const results = slugs.map(processPage);
const done = results.filter((r) => r.ok);
const fixed = results.filter((r) => r.skeleton);

console.log(`\n✅ 完成 ${done.length}/${slugs.length} 頁`);
if (fixed.length) console.log(`🔧 補了文件骨架：${fixed.map((r) => r.slug).join(", ")}`);
const withFaq = results.filter((r) => r.faqCount > 0);
if (withFaq.length) {
  console.log(`❓ FAQ 結構化資料：${withFaq.map((r) => `${r.slug}(${r.faqCount}題)`).join(", ")}`);
}
const withCluster = results.filter((r) => r.clustered);
console.log(`🔗 主題群集連結：${withCluster.length} 頁`);
const cleaned = results.filter((r) => r.legacyRemoved);
if (cleaned.length) {
  console.log(`🧹 清掉舊的 RealEstateAgent 區塊：${cleaned.map((r) => r.slug).join(", ")}`);
}
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`❌ 失敗：${failed.map((r) => r.slug).join(", ")}`);
  process.exit(1);
}
