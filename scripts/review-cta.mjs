/**
 * 在每一頁底部補上「留 Google 評論」的引導區塊。可重複執行，不會疊加。
 *
 * 為什麼要有這支：
 *   Google 沒有提供「在自己網站上直接寫評論」的官方元件，唯一官方支援的做法
 *   就是把讀者導去 Google 商家的評論連結（g.page/r/<id>/review）。所以這裡做的
 *   是「引導」不是「內嵌」，不需要 API 金鑰、不需要外部 script，也不會拖慢頁面。
 *
 * 注意（Google 政策）：
 *   可以請人留評論，但**不能只找滿意的人留**（review gating），也不能用禮物、
 *   折扣換評論。所以文案刻意寫成中性的「留一則評論」，不要改成「覺得有幫助再點」。
 *
 * 樣式全部寫死不吃 CSS 變數：各頁配色系統不同（工具頁是米白/深藍/金，
 * 國旅頁是米白/深藍/珊瑚橘），用 var() 會在某些頁面變成看不見的字。
 *
 * 用法：node scripts/review-cta.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const REVIEW_URL = "https://g.page/r/Cc3MaJq-9w1REAE/review";

const BEGIN = "<!-- REVIEW:AUTO 由 scripts/review-cta.mjs 產生，不要手改 -->";
const END = "<!-- /REVIEW:AUTO -->";

/** 內部工具頁，給自己人用的，不對外要評論 */
const SKIP = new Set(["591"]);

const BLOCK = `${BEGIN}
<section class="gr-cta" aria-labelledby="gr-cta-h">
  <div class="gr-inner">
    <p class="gr-eyebrow">GOOGLE 評論</p>
    <h2 id="gr-cta-h">這些整理，有幫到你嗎？</h2>
    <p class="gr-lede">留一則 Google 評論，讓其他正在煩惱同樣問題的人，也找得到這裡。<br>一句話就夠，不用寫長。</p>
    <a class="gr-btn" href="${REVIEW_URL}" target="_blank" rel="noopener noreferrer">
      <svg class="gr-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2l2.9 6.6 7.1.7-5.3 4.8 1.5 7-6.2-3.6L5.8 21l1.5-7L2 9.3l7.1-.7z"/></svg>
      去 Google 留評論
    </a>
    <p class="gr-note">會開啟 Google 地圖的評論視窗，需要登入 Google 帳號。</p>
  </div>
</section>
<style>
.gr-cta{max-width:820px;margin:34px auto 40px;padding:26px 24px;
 background:#16283f;border-radius:16px;color:#e9edf2;
 font-family:"Noto Sans TC",system-ui,-apple-system,"Microsoft JhengHei",sans-serif;
 text-align:center;box-sizing:border-box}
.gr-cta *{box-sizing:border-box}
.gr-inner{max-width:34em;margin:0 auto}
.gr-cta .gr-eyebrow{margin:0 0 8px;font-size:12.5px;letter-spacing:.2em;color:#e8c887;font-weight:500}
.gr-cta h2{margin:0 0 10px;font-size:23px;line-height:1.4;color:#fff;font-weight:700;
 font-family:"Noto Sans TC",system-ui,-apple-system,"Microsoft JhengHei",sans-serif}
.gr-cta .gr-lede{margin:0 0 20px;font-size:16px;line-height:1.8;color:#cfd8e2}
.gr-cta .gr-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;
 min-height:52px;padding:13px 30px;border-radius:999px;
 background:#c8963e;color:#20180a;text-decoration:none;
 font-size:17px;font-weight:700;line-height:1.4}
.gr-cta .gr-btn:hover{background:#dcae5c}
.gr-cta .gr-btn:focus-visible{outline:3px solid #e8c887;outline-offset:3px}
.gr-cta .gr-star{width:20px;height:20px;fill:#20180a;flex:none}
.gr-cta .gr-note{margin:14px 0 0;font-size:13.5px;color:#9fb0c4;line-height:1.65}
@media(max-width:640px){
  .gr-cta{margin:26px 16px 32px;padding:22px 18px}
  .gr-cta h2{font-size:20px}
  .gr-cta .gr-btn{width:100%}
}
</style>
${END}`;

/** 清掉舊區塊 → 塞新的到 </body> 前（沒有 </body> 就接在最後） */
function inject(file) {
  let html = fs.readFileSync(file, "utf8");

  html = html.replace(
    new RegExp(
      `\\n?${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END}\\n?`,
      "g",
    ),
    "\n",
  );

  const closeBody = html.search(/<\/body>/i);
  html =
    closeBody === -1
      ? `${html}\n${BLOCK}\n`
      : html.slice(0, closeBody) + BLOCK + "\n" + html.slice(closeBody);

  fs.writeFileSync(file, html, "utf8");
}

const targets = [];

// 1) 內容頁：public/<slug>/index.html
for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
  const file = path.join(PUBLIC_DIR, entry.name, "index.html");
  if (fs.existsSync(file)) targets.push([entry.name, file]);
}

// 2) 客戶專用單頁報告：public/r/*.html（noindex，但實際會有客戶讀，是最可能留評論的人）
const rDir = path.join(PUBLIC_DIR, "r");
if (fs.existsSync(rDir)) {
  for (const name of fs.readdirSync(rDir)) {
    if (name.endsWith(".html")) targets.push([`r/${name}`, path.join(rDir, name)]);
  }
}

for (const [label, file] of targets) inject(file);

console.log(`REVIEW:AUTO 已注入 ${targets.length} 頁`);
console.log(`略過（內部工具頁）：${[...SKIP].join(", ")}`);
