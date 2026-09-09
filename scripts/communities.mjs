/**
 * 產生「海線社區成交索引」——把四個房價分析頁裡的實價登錄資料，
 * 依社區重新聚合成一頁可搜尋的索引。
 *
 * 為什麼要有這頁：
 *   現有四個分析頁是「以行政區為單位」的敘事，但買方在 Google 打的字是
 *   社區名——「遠雄幸福成 成交」「梧棲隱富 房價」。那種長尾關鍵字
 *   目前站上沒有任何一頁吃得到。
 *
 * 為什麼是一頁而不是 148 頁：
 *   148 個社區裡有 113 個只有 1~2 筆成交。一頁只寫「今年成交 1 筆」
 *   不叫資料庫，Google 會判低品質，還會拖累現有的分析頁。
 *   全部塞一頁，內容密度夠，長尾關鍵字照樣吃得到。
 *
 * 資料來源就是那四頁自己內嵌的 DATA 陣列——不另外維護一份。
 * 那四頁重產之後這裡重跑就同步，不會出現兩邊數字對不上。
 *
 * 用法：node scripts/communities.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(PUBLIC_DIR, "haixian-communities");

/** 分析頁 slug -> 顯示用的區名 */
const AREAS = {
  "shalu-115-price": "沙鹿區",
  "wuqi-115-price": "梧棲區",
  "longjing-115-price": "龍井區",
  "qingshui-115-price": "清水區",
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 從分析頁的 HTML 裡把內嵌的 DATA 陣列挖出來 */
function readArea(slug) {
  const file = path.join(PUBLIC_DIR, slug, "index.html");
  if (!fs.existsSync(file)) return [];
  const html = fs.readFileSync(file, "utf8");
  const m = html.match(/DATA\s*=\s*(\[[\s\S]*?\])\s*[;\n]/);
  if (!m) {
    console.warn("  ⚠ " + slug + "：抓不到 DATA，略過");
    return [];
  }
  try {
    return JSON.parse(m[1]);
  } catch {
    console.warn("  ⚠ " + slug + "：DATA 不是合法 JSON，略過");
    return [];
  }
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const r1 = (n) => Math.round(n * 10) / 10;

// ── 聚合 ────────────────────────────────────────────────
const byName = new Map();
let totalRows = 0;
let named = 0;

for (const [slug, area] of Object.entries(AREAS)) {
  for (const row of readArea(slug)) {
    totalRows += 1;
    const name = (row.c || "").trim();
    if (!name) continue; // 透天／公寓本來就沒有社區名
    named += 1;
    const key = area + "|" + name;
    if (!byName.has(key)) byName.set(key, { name, area, rows: [] });
    byName.get(key).rows.push(row);
  }
}

const communities = [...byName.values()]
  .map((c) => {
    const num = (k) => c.rows.map((r) => r[k]).filter((n) => typeof n === "number" && n > 0);
    const units = num("u");
    const prices = num("p");
    const sizes = num("s");
    const ages = c.rows.map((r) => r.g).filter((n) => typeof n === "number");
    const dates = c.rows.map((r) => r.d).filter(Boolean).sort();
    return {
      name: c.name,
      area: c.area,
      n: c.rows.length,
      uMid: units.length ? r1(median(units)) : null,
      uMin: units.length ? r1(Math.min(...units)) : null,
      uMax: units.length ? r1(Math.max(...units)) : null,
      pMin: prices.length ? Math.round(Math.min(...prices)) : null,
      pMax: prices.length ? Math.round(Math.max(...prices)) : null,
      sMin: sizes.length ? r1(Math.min(...sizes)) : null,
      sMax: sizes.length ? r1(Math.max(...sizes)) : null,
      age: ages.length ? Math.round(median(ages)) : null,
      last: dates.length ? dates[dates.length - 1] : "",
      types: [...new Set(c.rows.map((r) => r.t).filter(Boolean))].join("・"),
    };
  })
  .sort((a, b) => b.n - a.n || a.area.localeCompare(b.area, "zh-Hant"));

const areaCount = {};
for (const a of Object.values(AREAS)) {
  areaCount[a] = communities.filter((c) => c.area === a).length;
}

console.log("讀到 " + totalRows + " 筆，其中 " + named + " 筆有社區名");
console.log("聚合成 " + communities.length + " 個社區");

// ── 產頁 ────────────────────────────────────────────────
const rowsHtml = communities
  .map((c) => {
    const uRange = c.uMin === c.uMax ? String(c.uMin) : c.uMin + "–" + c.uMax;
    const pRange = c.pMin === c.pMax ? String(c.pMin) : c.pMin + "–" + c.pMax;
    const sRange = c.sMin === c.sMax ? String(c.sMin) : c.sMin + "–" + c.sMax;
    const sub =
      esc(c.area) + "・" + esc(c.types) + (c.age !== null ? "・屋齡約 " + c.age + " 年" : "");
    return (
      '<tr data-name="' + esc(c.name) + '" data-area="' + esc(c.area) + '">' +
      '<td class="cname"><b>' + esc(c.name) + '</b><span class="meta">' + sub + "</span></td>" +
      '<td class="num"><b>' + c.n + "</b> 筆</td>" +
      '<td class="num">' + (c.uMid !== null ? "<b>" + c.uMid + "</b> 萬" : "—") +
      '<span class="meta">' + uRange + "</span></td>" +
      '<td class="num">' + pRange + " 萬</td>" +
      '<td class="num">' + sRange + " 坪</td>" +
      '<td class="num">' + esc(c.last) + "</td></tr>"
    );
  })
  .join("\n");

const chips = Object.entries(areaCount)
  .map(
    ([a, n]) =>
      '<button class="chip" data-f="' + esc(a) + '" aria-pressed="false">' +
      esc(a) + " <span>" + n + "</span></button>",
  )
  .join("");

const N = communities.length;

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>海線社區成交索引｜沙鹿・梧棲・龍井・清水 ${N} 個社區實價登錄｜海線房仲冠良</title>
<meta name="description" content="台中海線 ${N} 個社區的實價登錄成交整理：中位單價、總價帶、坪數區間、最近成交日，可搜尋可篩選。資料取自內政部實價登錄 115 年度成交共 ${named} 筆。">
<meta property="og:title" content="海線社區成交索引｜${N} 個社區實價登錄">
<meta property="og:description" content="想知道某個社區今年成交多少？沙鹿、梧棲、龍井、清水 ${N} 個社區一次查。">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
:root{--cream:#f7f3ea;--cream-2:#efe8da;--navy:#16283f;--gold:#c8963e;--gold-soft:#e8c887;
 --ink:#2b2b2b;--muted:#6f6a60;--line:#ddd2bd}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--cream);color:var(--ink);font-size:17px;line-height:1.8;
 font-family:"Noto Sans TC",system-ui,-apple-system,"Microsoft JhengHei",sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1000px;margin:0 auto;padding:0 18px}

header{background:var(--navy);color:var(--cream);padding:34px 0 30px}
.eyebrow{font-size:15px;letter-spacing:.18em;color:var(--gold-soft);font-weight:700;margin-bottom:12px}
h1{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:clamp(27px,5.6vw,40px);line-height:1.25;margin-bottom:12px}
h1 em{font-style:normal;color:var(--gold-soft)}
.lede{color:#cfd8e2;font-size:16.5px;max-width:38em}
.stats{display:flex;flex-wrap:wrap;gap:10px 26px;margin-top:18px;font-size:15.5px;color:#a9bccd}
.stats b{color:var(--gold-soft);font-size:21px;font-family:"DM Serif Display",Georgia,serif}

.toolbar{position:sticky;top:0;z-index:10;background:var(--cream);border-bottom:1px solid var(--line);padding:14px 0}
#q{width:100%;min-height:50px;padding:12px 16px;font-size:17px;border:1px solid var(--line);
 border-radius:10px;background:#fff;color:var(--ink);font-family:inherit}
#q:focus{outline:2px solid var(--gold);outline-offset:1px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.chip{min-height:44px;padding:8px 15px;border-radius:999px;border:1px solid var(--line);background:#fff;
 color:var(--ink);font-size:15px;font-family:inherit;cursor:pointer}
.chip span{color:var(--muted);font-size:15px}
.chip[aria-pressed="true"]{background:var(--navy);color:var(--cream);border-color:var(--navy)}
.chip[aria-pressed="true"] span{color:var(--gold-soft)}
.count{margin-top:10px;font-size:15px;color:var(--muted)}

.tablewrap{overflow-x:auto;margin:18px 0 0;border:1px solid var(--line);border-radius:12px;background:#fff}
table{border-collapse:collapse;width:100%;font-size:15.5px}
thead th{background:var(--cream-2);text-align:right;font-weight:500;color:var(--muted);font-size:15px;
 padding:11px 13px;border-bottom:1px solid var(--line);white-space:nowrap}
thead th:first-child{text-align:left}
tbody td{padding:13px;border-bottom:1px solid var(--cream-2);text-align:right;
 font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--muted)}
tbody td.cname{text-align:left;white-space:normal;min-width:200px;color:var(--ink)}
tbody td.cname b{font-size:17px;color:var(--navy);display:block;line-height:1.5}
.meta{display:block;font-size:15px;color:var(--muted);font-weight:400}
tbody td b{color:var(--navy);font-size:17px}
tbody tr:last-child td{border-bottom:0}
tbody tr[hidden]{display:none}
.empty{padding:28px 16px;text-align:center;color:var(--muted)}

.thin{background:var(--cream-2);border:1px solid var(--line);border-radius:10px;padding:15px 17px;
 margin-top:16px;font-size:15.5px;color:var(--muted);line-height:1.75}
.thin b{color:var(--navy)}
.note{margin:16px 0 0;padding:18px 20px;background:#fff;border:1px solid var(--line);border-radius:12px;
 font-size:15.5px;color:var(--muted);line-height:1.8}
.note b{color:var(--navy)}
.note p+p{margin-top:10px}
.cta{background:var(--gold);border-radius:14px;padding:26px 22px;margin:26px 0 34px;text-align:center;color:#3a2a0c}
.cta h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:25px;margin-bottom:6px}
.cta p{font-size:16px;margin-bottom:18px}
.cta a{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:13px 30px;
 background:var(--navy);color:var(--cream);border-radius:999px;font-weight:700;font-size:17px}

footer{background:var(--navy);color:#a9b6c4;padding:26px 0 34px;font-size:15px;line-height:1.8}
footer b{color:var(--cream);font-size:17px;display:block}
footer a{color:var(--gold-soft);display:inline-flex;align-items:center;min-height:44px}
footer .fl{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:4px}

@media(max-width:640px){
  thead{display:none}
  table,tbody,tr,td{display:block;width:100%}
  tbody tr{border:1px solid var(--line);border-radius:10px;margin:0 0 10px;padding:14px 16px;background:#fff}
  /* 卡片版：標籤靠左，數值與單位當成一組靠右。
     ⚠️ 用 space-between 會把「47」跟「筆」也一起拉開，看起來像壞掉；
        改成標籤吃掉剩餘空間（margin-right:auto），其餘自然黏在右邊。 */
  tbody td{border-bottom:0;padding:5px 0;display:flex;align-items:baseline;gap:6px;text-align:right}
  tbody td.cname{display:block;padding:0 0 10px;margin-bottom:8px;border-bottom:1px solid var(--cream-2)}
  tbody td[data-l]::before{content:attr(data-l);color:var(--muted);font-size:15px;
   text-align:left;flex:none;margin-right:auto;padding-right:14px}
  tbody td .meta{display:inline;font-size:15px}
  .tablewrap{border:0;background:transparent;overflow:visible}
}
</style>
</head>
<body>

<header>
  <div class="wrap">
    <p class="eyebrow">台中海線・實價登錄整理</p>
    <h1>海線社區<em>成交索引</em></h1>
    <p class="lede">想知道某個社區今年到底成交多少錢？這裡把沙鹿、梧棲、龍井、清水的實價登錄，依社區重新整理過。直接搜社區名就查得到。</p>
    <div class="stats">
      <span><b>${N}</b> 個社區</span>
      <span><b>${named}</b> 筆成交</span>
      <span><b>4</b> 個行政區</span>
    </div>
  </div>
</header>

<div class="wrap">
  <div class="toolbar">
    <input id="q" type="search" placeholder="搜社區名稱，例如：遠雄幸福成" aria-label="搜尋社區名稱">
    <div class="chips">
      <button class="chip" data-f="" aria-pressed="true">全部 <span>${N}</span></button>
      ${chips}
    </div>
    <p class="count" id="count"></p>
  </div>

  <div class="tablewrap">
    <table>
      <thead>
        <tr><th>社區</th><th>成交</th><th>中位單價</th><th>總價帶</th><th>坪數</th><th>最近成交</th></tr>
      </thead>
      <tbody id="tb">
${rowsHtml}
      </tbody>
    </table>
    <p class="empty" id="empty" hidden>找不到符合的社區。試試只打社區名的前兩個字。</p>
  </div>

  <p class="thin">⚠️ <b>只有 1～2 筆成交的社區，數字僅供參考。</b>樣本太少的時候，一戶特別高或特別低就會把整個數字帶偏。要判斷某個社區的真實行情，建議看該區的完整分析，或直接找我拉同社區還在賣的每一戶來比。</p>

  <div class="note">
    <p><b>資料來源與限制</b></p>
    <p>資料為內政部實價登錄 115 年度成交，整理後依社區聚合。<b>只涵蓋有登記社區名稱的成交</b>——透天、公寓等沒有社區名的物件不在此列，所以這裡的 ${named} 筆少於四區的總成交筆數。</p>
    <p>中位單價是該社區成交單價的中位數，比平均值不容易被極端值帶偏。總價帶與坪數是該社區成交的最低到最高。<b>實價登錄有申報時間差，最新的成交可能還沒揭露。</b></p>
  </div>

  <div class="cta">
    <h2>想看某個社區更細的？</h2>
    <p>我可以拉出那個社區目前還在賣的每一戶，逐筆比總價、坪數、單價、樓層、屋齡，做成一份你看得懂的比價報告。</p>
    <a href="/card/booking">預約時間聊聊</a>
  </div>
</div>

<footer>
  <div class="wrap">
    <b>海線房仲冠良・吳冠良</b>
    懂你又懂房 🏡
    <div class="fl">
      <a href="tel:0915295958">0915-295958</a>
      <a href="https://lin.ee/1WlfBub">LINE 諮詢</a>
      <a href="/shalu-115-price">沙鹿完整分析</a>
      <a href="/wuqi-115-price">梧棲完整分析</a>
      <a href="/longjing-115-price">龍井完整分析</a>
      <a href="/qingshui-115-price">清水完整分析</a>
      <a href="/">回首頁</a>
    </div>
  </div>
</footer>

<script>
(function () {
  var q = document.getElementById("q"),
    tb = document.getElementById("tb"),
    cnt = document.getElementById("count"),
    empty = document.getElementById("empty"),
    rows = [].slice.call(tb.rows),
    chips = [].slice.call(document.querySelectorAll(".chip")),
    area = "";

  // 手機卡片版要靠 data-l 顯示欄位名稱
  var labels = ["", "成交筆數", "中位單價", "總價帶", "坪數", "最近成交"];
  rows.forEach(function (r) {
    [].forEach.call(r.cells, function (td, i) {
      if (i) td.setAttribute("data-l", labels[i]);
    });
  });

  function apply() {
    var kw = q.value.trim().toLowerCase(),
      shown = 0;
    rows.forEach(function (r) {
      var okA = !area || r.dataset.area === area;
      var okQ = !kw || r.dataset.name.toLowerCase().indexOf(kw) > -1;
      var on = okA && okQ;
      r.hidden = !on;
      if (on) shown++;
    });
    cnt.textContent =
      "顯示 " + shown + " 個社區" + (area ? "（" + area + "）" : "") +
      (kw ? "，關鍵字「" + q.value.trim() + "」" : "");
    empty.hidden = shown > 0;
  }

  q.addEventListener("input", apply);
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      area = c.dataset.f;
      chips.forEach(function (x) {
        x.setAttribute("aria-pressed", String(x === c));
      });
      apply();
    });
  });
  apply();
})();
</script>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "index.html"), html, "utf8");
console.log("寫好 public/haixian-communities/index.html（" + (html.length / 1024).toFixed(0) + " KB）");
