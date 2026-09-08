/**
 * 網誌共用樣式。沿用品牌 CIS：深藍 #16283f／金 #c8963e／米 #f7f3ea。
 *
 * 幾個刻意的決定（量過 cathome.tw 之後）：
 * - 內文 18px，不是一般的 16px。房產文章都很長，手機上小一號就讀不下去。
 * - 標題前面掛 emoji 圖示 —— 手機動態牆式的瀏覽，純文字標題會被滑過去。
 * - 手機底部固定「預約／LINE／電話」列。讀者想聯絡時人在文章中段，
 *   不會為了找按鈕捲回最上面。
 * - 所有可點區塊至少 44px 高（拇指點得到）。
 */
export const BLOG_CSS = `
:root{
  --cream:#f7f3ea; --cream-2:#efe8da;
  --navy:#16283f; --navy-2:#1f3752;
  --gold:#c8963e; --gold-soft:#e8c887;
  --ink:#2b2b2b; --muted:#6f6a60; --line:#ddd2bd;
}
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:var(--cream); color:var(--ink);
  font-family:"Noto Sans TC",system-ui,-apple-system,"Microsoft JhengHei",sans-serif;
  font-size:18px; line-height:1.85; -webkit-font-smoothing:antialiased;
  padding-bottom:76px; /* 讓開手機底部固定列 */
}
@media(min-width:900px){ body{padding-bottom:0} }
a{color:inherit}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}


/* ── 頁首導覽圖 NavMap（Chibi_Business_Manga_v1）──────────────
   手機讀者不會從頭讀到尾，先給一張三秒看懂的卡片。
   ⚠️ 這一區刻意用冷白底 #F4F6F9，跟內文的暖米白區隔，
      讓它看起來像「一張卡片」而不是內文的一部分。 */
.navmap{
  --nm-bg:#F4F6F9; --nm-ink:#0A2540; --nm-gold:#E69C24; --nm-blue:#1A56B0;
  background:var(--nm-bg);
  border:3px solid var(--nm-ink);
  border-radius:20px;
  margin:22px 0 26px;
  padding:16px 14px 18px;
  color:var(--nm-ink);
  box-shadow:0 2px 0 #DCE3EC, 0 12px 26px -16px rgba(10,37,64,.4);
  background-image:
    linear-gradient(rgba(26,86,176,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(26,86,176,.05) 1px, transparent 1px);
  background-size:24px 24px;
}
.nm-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.nm-tag{
  display:inline-block;background:var(--nm-gold);color:#20180A;
  font-size:13px;font-weight:900;letter-spacing:.06em;
  padding:4px 12px;border-radius:999px;border:2px solid var(--nm-ink);margin-bottom:8px;
}
.nm-h{font-size:23px;font-weight:900;line-height:1.3;color:var(--nm-ink);margin:0}

/* 關鍵數字 */
.nm-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.nm-fact{
  background:#fff;border:2.5px solid var(--nm-ink);border-radius:14px;
  padding:11px 6px;text-align:center;
}
.nm-fact b{
  display:block;font-size:clamp(17px,4.6vw,22px);font-weight:900;color:var(--nm-blue);
  line-height:1.2;font-variant-numeric:tabular-nums;
}
.nm-fact span{display:block;font-size:12px;color:#5B6B80;margin-top:2px;font-weight:500}
.nm-fact:first-child b{color:#B4700D}
@media(max-width:420px){ .nm-facts{grid-template-columns:1fr;gap:6px} .nm-fact{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;text-align:left} .nm-fact span{margin:0} }

/* 三道關卡 */
.nm-steps{list-style:none;display:flex;flex-direction:column;gap:9px;margin:0;padding:0}
.nm-steps li{margin:0}
.nm-steps a,.nm-static{
  display:flex;gap:11px;align-items:flex-start;
  background:#fff;border:2.5px solid var(--nm-ink);border-radius:14px;
  padding:11px 13px;text-decoration:none;color:var(--nm-ink);
  min-height:44px;
}
.nm-steps a:hover{background:#FFF6E6}
.nm-steps a:focus-visible{outline:3px solid var(--nm-gold);outline-offset:2px}
.nm-n{
  width:25px;height:25px;flex:none;border-radius:50%;
  background:var(--nm-gold);color:#20180A;border:2px solid var(--nm-ink);
  display:grid;place-items:center;font-weight:900;font-size:14px;line-height:1;margin-top:2px;
}
.nm-b{display:flex;flex-direction:column;gap:1px;min-width:0}
.nm-b b{font-size:16.5px;font-weight:900;line-height:1.45}
.nm-b b em{
  font-style:normal;color:#fff;background:var(--nm-blue);
  font-size:12.5px;font-weight:700;padding:2px 7px;border-radius:999px;margin-right:7px;
  vertical-align:2px;white-space:nowrap;
}
.nm-b > span{font-size:14.5px;color:#33455C;line-height:1.7}


/* ── 圖卡組 CardDeck（Chibi_Business_Manga_v1）────────────────
   一張卡講一件事。整段解說由卡片承載，文字段落只留給法條。
   ⚠️ 冷白底 #F4F6F9 是刻意的，跟內文暖米白區隔，看起來才像「卡片」。 */
.deck{
  --ck-bg:#F4F6F9; --ck-ink:#0A2540; --ck-gold:#E69C24; --ck-blue:#1A56B0; --ck-mute:#5B6B80;
  display:flex;flex-direction:column;gap:14px;margin:22px 0 28px;
}
.ck{
  background:var(--ck-bg);color:var(--ck-ink);
  border:3px solid var(--ck-ink);border-radius:20px;
  box-shadow:0 2px 0 #DCE3EC, 0 12px 26px -16px rgba(10,37,64,.4);
  background-image:
    linear-gradient(rgba(26,86,176,.05) 1px,transparent 1px),
    linear-gradient(90deg,rgba(26,86,176,.05) 1px,transparent 1px);
  background-size:24px 24px;
  overflow:hidden;
}
.ck-hd{display:flex;align-items:center;gap:10px;padding:15px 15px 0}
.ck-hd > div{flex:1;min-width:0}
.ck-hd h2{font-size:21px;font-weight:900;line-height:1.3;margin:0;color:var(--ck-ink)}
.ck-hd p{font-size:14px;color:var(--ck-mute);margin:2px 0 0;line-height:1.6}
.ck-dot{
  width:32px;height:32px;flex:none;border-radius:50%;
  background:var(--ck-gold);color:#20180A;border:2.5px solid var(--ck-ink);
  display:grid;place-items:center;font-weight:900;font-size:16px;line-height:1;
}
.ck-dot.x{background:#E4573D;color:#fff}

/* 關鍵數字 */
.ck-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:0}
.ck-fact{padding:14px 8px;text-align:center;border-right:2px solid #DCE3EC}
.ck-fact:last-child{border-right:none}
.ck-fact b{display:block;font-size:clamp(17px,4.6vw,23px);font-weight:900;color:var(--ck-blue);
  line-height:1.2;font-variant-numeric:tabular-nums}
.ck-fact b.hot{color:#B4700D}
.ck-fact span{display:block;font-size:12px;color:var(--ck-mute);margin-top:2px;font-weight:500}
@media(max-width:430px){
  .ck-facts{grid-template-columns:1fr}
  .ck-fact{display:flex;justify-content:space-between;align-items:center;text-align:left;
    padding:11px 15px;border-right:none;border-bottom:2px solid #DCE3EC}
  .ck-fact:last-child{border-bottom:none}
  .ck-fact span{margin:0}
}

/* 編號關卡 */
.ck-steps ol{list-style:none;margin:0;padding:13px 13px 15px;display:flex;flex-direction:column;gap:9px}
.ck-steps li{margin:0}
.ck-steps a,.ck-static{
  display:flex;gap:10px;align-items:center;background:#fff;
  border:2.5px solid var(--ck-ink);border-radius:14px;padding:11px 12px;
  text-decoration:none;color:var(--ck-ink);min-height:44px;
}
.ck-steps a:hover{background:#FFF6E6}
.ck-steps a:focus-visible{outline:3px solid var(--ck-gold);outline-offset:2px}
.ck-n{width:25px;height:25px;flex:none;border-radius:50%;background:var(--ck-gold);color:#20180A;
  border:2px solid var(--ck-ink);display:grid;place-items:center;font-weight:900;font-size:14px;line-height:1}
.ck-ic{flex:none}
.ck-b{display:flex;flex-direction:column;gap:1px;min-width:0}
.ck-b b{font-size:16.5px;font-weight:900;line-height:1.45}
.ck-b b em{font-style:normal;color:#fff;background:var(--ck-blue);font-size:12.5px;font-weight:700;
  padding:2px 7px;border-radius:999px;margin-right:7px;vertical-align:2px;white-space:nowrap}
.ck-b > span{font-size:14.5px;color:#33455C;line-height:1.7}

/* 錯誤說法 vs 正解 */
.ck-myth-bd{padding:12px 15px 16px;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.ck-myth-bd > svg{flex:none;margin:0 auto}
.ck-myth-bd > div{flex:1;min-width:min(100%,15rem)}
.ck-wrong{background:#FDECEC;border:2px dashed #C0392B;color:#8E2A1E;border-radius:10px;
  padding:9px 12px;font-size:15px;font-weight:500;line-height:1.7;margin:0 0 11px}
.ck-check{list-style:none;display:flex;flex-direction:column;gap:8px;margin:0;padding:0}
.ck-check li{display:flex;gap:9px;align-items:flex-start;font-size:15.5px;line-height:1.7}
.ck-m{flex:none;width:22px;height:22px;margin-top:4px}
.ck-punch{background:#FFF6E6;border:2.5px solid var(--ck-gold);border-radius:10px;
  padding:10px 13px;font-size:16px;font-weight:700;line-height:1.7;margin:11px 0 0}

/* 死線／警示 */
.ck-warn{border-color:#B03A26}
.ck-warn-bn{background:#B03A26;color:#fff;padding:9px 15px;font-size:15px;font-weight:900;letter-spacing:.04em}
.ck-warn-bd{padding:13px 15px 15px}
.ck-lead{font-size:14.5px;color:#33455C;margin:0 0 10px;line-height:1.7}
.ck-warn-bd ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ck-warn-bd li{display:flex;gap:10px;align-items:baseline;background:#fff;
  border:2px solid #E2C9C3;border-radius:12px;padding:10px 12px;flex-wrap:wrap}
.ck-warn-bd li b{font-size:15.5px;font-weight:900;flex:none;color:#8E2A1E}
.ck-warn-bd li span{font-size:14.5px;color:#33455C;line-height:1.65}

/* 金句 */
.ck-quote{background:#fff;background-image:none}
.ck-quote-bn{background:var(--ck-ink);color:#fff;padding:8px 15px;font-size:13px;font-weight:700;letter-spacing:.14em}
.ck-quote-bd{padding:20px 16px;text-align:center}
.ck-quote-bd p{font-size:clamp(19px,5.2vw,25px);font-weight:900;line-height:1.55;text-wrap:balance;margin:0}
.ck-quote-bd .k{color:var(--ck-gold);-webkit-text-stroke:1.6px var(--ck-ink);paint-order:stroke fill}

/* ── 頁首 ── */
.bhead{background:var(--navy);color:var(--cream);padding:44px 0 38px;position:relative;overflow:hidden}
.bhead:before{content:"";position:absolute;inset:0;
  background:radial-gradient(circle at 88% 10%,rgba(200,150,62,.22),transparent 55%)}
.bhead .wrap{position:relative}
.crumb{font-size:14px;color:var(--gold-soft);margin-bottom:12px}
.crumb a{display:inline-block;padding:10px 2px;min-height:40px;line-height:20px;
  text-decoration:none;opacity:.85}
.crumb a:hover{opacity:1;text-decoration:underline}
.bhead h1{
  font-family:"DM Serif Display",Georgia,serif;font-weight:400;
  font-size:clamp(30px,6vw,46px);line-height:1.25;margin-bottom:12px;
  letter-spacing:.01em}
/* 日期／閱讀時間是「資訊標籤」，摘要是「內容」——不要用同一個 ・ 串成一長行，
   會變成日期跟句子黏在一起看不出斷點（2026-08-22 BOSS 指正）。 */
.bhead .meta{color:var(--gold-soft);font-size:14px;margin-bottom:10px;opacity:.9}
.bhead .lede{color:#cfd8e2;font-size:17px;line-height:1.65;max-width:36em}

/* ── 分類籤 ── */
.cats{display:flex;gap:10px;overflow-x:auto;padding:18px 0 4px;-webkit-overflow-scrolling:touch}
.cats::-webkit-scrollbar{display:none}
.cat{
  flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;
  min-height:44px;padding:0 18px;border-radius:999px;
  background:#fff;border:1px solid var(--line);color:var(--navy);
  font-size:15px;font-weight:500;text-decoration:none;white-space:nowrap}
.cat:hover{border-color:var(--gold)}
.cat[aria-current="page"]{background:var(--navy);color:var(--cream);border-color:var(--navy)}

/* ── 文章卡片 ── */
.grid{display:grid;gap:18px;padding:26px 0 40px}
@media(min-width:720px){ .grid{grid-template-columns:1fr 1fr} }
.card{
  display:flex;gap:14px;background:#fff;border:1px solid var(--line);
  border-radius:16px;padding:18px;text-decoration:none;
  box-shadow:0 2px 0 rgba(22,40,63,.05);transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:var(--gold)}
.card .ico{
  flex:0 0 48px;height:48px;border-radius:13px;background:var(--cream-2);
  display:grid;place-items:center;font-size:26px;line-height:1}
@media(min-width:720px){ .card .ico{flex:0 0 56px;height:56px;font-size:30px} }
.card .body{min-width:0}
.tagline{display:flex;align-items:center;gap:8px;margin-bottom:7px;line-height:1.7}
.tag{
  display:inline-block;flex:0 0 auto;background:var(--navy);color:var(--gold-soft);
  font-size:12.5px;font-weight:500;padding:3px 10px;border-radius:999px;
  letter-spacing:.04em;white-space:nowrap;line-height:1.7}
.meta{font-size:12.5px;color:var(--muted);white-space:nowrap}
.card h2{
  font-size:19px;line-height:1.5;color:var(--navy);font-weight:700;margin-bottom:6px;
  /* 標題最多三行，卡片才不會高矮不一 */
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card p{font-size:15px;color:var(--muted);line-height:1.7;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* ── 分類區塊標題（圖文化）── */
.sec{padding:34px 0 6px}
.sec h2{
  display:flex;align-items:center;gap:12px;line-height:1.35;
  font-family:"DM Serif Display",Georgia,serif;font-weight:400;
  font-size:29px;color:var(--navy)}
.sec h2 .chip{
  width:46px;height:46px;border-radius:13px;background:var(--navy);
  display:grid;place-items:center;font-size:24px;line-height:1}
.sec .sub{margin-top:6px;color:var(--muted);font-size:15px}

/* ── 影片嵌入 ── */
.video{margin:26px 0 0}
.video iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:16px;display:block;
  background:var(--navy);box-shadow:0 6px 20px rgba(22,40,63,.14)}
/* Shorts 是直式的。不限寬度的話在桌機會變成一根佔滿整個畫面的長條。 */
.video.vertical iframe{aspect-ratio:9/16;max-width:340px;margin:0 auto}

/* ── 文章內文 ── */
.article{background:#fff;border:1px solid var(--line);border-radius:18px;
  padding:30px 24px;margin:26px 0 34px}
@media(min-width:720px){ .article{padding:44px 48px} }
.article h2{
  font-family:"DM Serif Display",Georgia,serif;font-weight:400;
  font-size:27px;line-height:1.4;color:var(--navy);margin:38px 0 12px;
  padding-left:14px;border-left:5px solid var(--gold)}
.article h3{font-size:20px;line-height:1.5;color:var(--navy);margin:26px 0 8px}
.article p{margin:0 0 18px}
.article ul,.article ol{margin:0 0 18px 1.3em}
.article li{margin-bottom:8px}
.article strong{color:var(--navy)}
.article blockquote{
  background:var(--cream);border-left:5px solid var(--gold);
  padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 20px;color:var(--muted)}
.article a{color:var(--navy);text-decoration:underline;text-decoration-color:var(--gold);
  text-underline-offset:3px}
.article img{max-width:100%;height:auto;border-radius:12px}
.article table{width:100%;min-width:320px;border-collapse:collapse;margin:0;font-size:16px}
.article th,.article td{border:1px solid var(--line);padding:10px 12px;text-align:left}
.article th{background:var(--cream-2);color:var(--navy)}
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 22px;
  border-radius:10px;border:1px solid var(--line)}
.tablewrap table{border:0}
.tablewrap th:first-child,.tablewrap td:first-child{border-left:0}
.tablewrap th:last-child,.tablewrap td:last-child{border-right:0}
.tablewrap tr:first-child th{border-top:0}

/* ── 相關文章／延伸閱讀 ── */
.rel{padding:0 0 40px}
.rel h2{font-size:21px;color:var(--navy);margin-bottom:14px}
.rellist{display:grid;gap:10px}
.rellist a{
  display:flex;align-items:center;gap:12px;min-height:52px;
  background:#fff;border:1px solid var(--line);border-radius:12px;
  padding:10px 16px;text-decoration:none;font-size:16px;color:var(--navy)}
.rellist a:hover{border-color:var(--gold)}
.rellist .e{font-size:22px}

/* ── 諮詢區 ── */
.cta{background:var(--gold);border-radius:18px;padding:30px 24px;text-align:center;
  color:#3a2a0c;margin-bottom:40px}
.cta h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:26px;margin-bottom:8px}
.cta p{font-size:16px;margin-bottom:20px}
.cta a{display:inline-block;background:var(--navy);color:var(--cream);text-decoration:none;
  padding:14px 32px;border-radius:999px;font-weight:700;min-height:48px;line-height:20px}

/* ── 手機底部固定列 ── */
.fab{
  position:fixed;left:0;right:0;bottom:0;z-index:60;display:grid;
  grid-template-columns:repeat(3,1fr);
  background:var(--navy);border-top:1px solid rgba(232,200,135,.25);
  padding-bottom:env(safe-area-inset-bottom)}
.fab a{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  min-height:60px;color:var(--cream);text-decoration:none;font-size:13px;font-weight:500}
.fab a+a{border-left:1px solid rgba(232,200,135,.18)}
.fab .i{font-size:20px;line-height:1}
.fab a:active{background:var(--navy-2)}
@media(min-width:900px){ .fab{display:none} }

footer.bfoot{background:var(--navy);color:#9fb0c4;padding:26px 0 30px;font-size:15px;text-align:center}
footer.bfoot .wrap{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:center;align-items:center}
footer.bfoot a{color:var(--gold-soft);display:inline-block;padding:9px 6px;min-height:40px;
  line-height:22px;text-decoration:none}
footer.bfoot a:hover{text-decoration:underline}
`;
