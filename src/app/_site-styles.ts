/**
 * 官網首頁 `/` 的樣式（海線房仲冠良 CIS：深藍 #16283f / 金 #c8963e / 米 #f7f3ea）
 * 與 kuanhome 官網同一套配色，字體 DM Serif Display + Noto Sans TC。
 */
export const SITE_CSS = `
:root{
  --cream:#f7f3ea; --cream-2:#efe8da;
  --navy:#16283f; --navy-2:#1f3752;
  --gold:#c8963e; --gold-soft:#e8c887;
  --ink:#2b2b2b; --muted:#6f6a60; --line:#ddd2bd;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--cream);color:var(--ink);line-height:1.78;-webkit-font-smoothing:antialiased;
  font-family:"Noto Sans TC",system-ui,-apple-system,"Microsoft JhengHei",sans-serif;padding-bottom:64px}
@media(min-width:721px){body{padding-bottom:0}}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px}
section{padding:58px 0}
.kicker{font-size:11.5px;letter-spacing:.24em;color:var(--gold);font-weight:700;margin:0 0 8px}
h2.title{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:clamp(28px,4.2vw,38px);
  color:var(--navy);line-height:1.2}
.record h2.title{color:var(--gold-soft)}
.lead{color:var(--muted);font-size:15.5px;max-width:40em;margin:6px 0 0}
.center{text-align:center}
.center .lead{margin-left:auto;margin-right:auto}

nav{position:sticky;top:0;z-index:30;background:rgba(247,243,234,.94);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
nav .wrap{display:flex;align-items:center;justify-content:space-between;height:60px;gap:16px}
.brand{font-weight:700;color:var(--navy);font-size:16.5px;white-space:nowrap}
.brand span{color:var(--gold);font-weight:500}
.navlinks{display:flex;gap:20px;font-size:14.5px;align-items:center}
.navlinks a{color:var(--muted);white-space:nowrap}
.navlinks a:hover{color:var(--navy)}
.navlinks a.pill{background:var(--gold);color:#3a2a0c;padding:7px 16px;border-radius:999px;font-weight:700}
.navlinks a.pill:hover{background:var(--gold-soft)}
@media(max-width:880px){.navlinks a:not(.pill){display:none}}

header.hero{background:var(--navy);color:var(--cream);padding:56px 0 60px;position:relative;overflow:hidden}
header.hero:before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 86% 14%,rgba(200,150,62,.24),transparent 55%)}
.herogrid{position:relative;display:grid;grid-template-columns:1fr auto;gap:44px;align-items:center}
.eyebrow{font-size:12.5px;letter-spacing:.24em;color:var(--gold-soft);margin:0 0 14px;font-weight:500}
h1{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:clamp(32px,6vw,52px);
  line-height:1.18;margin:0 0 16px}
h1 em{font-style:normal;color:var(--gold-soft)}
.lede{margin:0;max-width:32em;color:#cfd8e2;font-size:16px}
.slogan{font-family:"DM Serif Display",Georgia,serif;color:var(--gold-soft);font-size:22px;margin:14px 0 0}
.checks{display:flex;flex-wrap:wrap;gap:8px 18px;margin:22px 0 0;list-style:none;font-size:14.5px;color:var(--gold-soft)}
.checks li:before{content:"\\2714 ";font-weight:700}
.herobtns{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:999px;font-weight:700;
  font-size:15.5px;transition:background .15s,color .15s,transform .12s}
.btn:hover{transform:translateY(-1px)}
.btn.gold{background:var(--gold);color:#3a2a0c}
.btn.gold:hover{background:var(--gold-soft)}
.btn.line{background:#06C755;color:#fff}
.btn.ghost{border:1px solid rgba(232,200,135,.55);color:var(--gold-soft)}
.btn.ghost:hover{background:rgba(232,200,135,.13)}
.disc{flex:0 0 auto;width:250px;height:250px;border-radius:50%;overflow:hidden;background:var(--cream);
  border:4px solid var(--gold-soft);box-shadow:0 16px 40px rgba(0,0,0,.34)}
.disc img{width:100%;height:100%;object-fit:cover}
@media(max-width:760px){
  .herogrid{grid-template-columns:1fr;text-align:center}
  .checks,.herobtns{justify-content:center}
  .lede{margin-left:auto;margin-right:auto}
  .disc{order:-1;width:150px;height:150px;margin:0 auto 6px}
}

.area{background:#fff;border-bottom:1px solid var(--line)}
.arealist{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:40px}
@media(max-width:640px){.arealist{grid-template-columns:repeat(3,1fr)}}
.area-card{background:linear-gradient(160deg,#fff,var(--cream));border:1px solid var(--line);
  border-radius:13px;padding:22px 8px;text-align:center;transition:transform .14s,border-color .14s,box-shadow .14s}
.area-card:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 8px 20px rgba(22,40,63,.09)}
.area-card .ic{font-size:26px}
.area-card b{display:block;color:var(--navy);font-size:17px;margin-top:6px}
.area-card span{font-size:11.5px;color:var(--muted)}
.area-note{text-align:center;margin-top:26px;color:var(--muted);font-size:14.5px}
.area-note b{color:var(--gold)}

.record{background:var(--navy);color:var(--cream);position:relative;overflow:hidden}
.record:before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 15% 0,rgba(200,150,62,.18),transparent 55%)}
.record .wrap{position:relative}
.record .lead{color:#cfd8e2}
.revcard{max-width:520px;margin:40px auto 0;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.16);border-radius:22px;padding:38px 30px;text-align:center;backdrop-filter:blur(4px)}
.revcard .big{font-family:"DM Serif Display",Georgia,serif;font-size:clamp(56px,11vw,88px);color:var(--gold-soft);line-height:1}
.revcard .stars{color:var(--gold);font-size:30px;letter-spacing:5px;margin:6px 0}
.revcard .sub{color:rgba(255,255,255,.85);font-size:16px;font-weight:600}
.revcard a{display:inline-block;margin-top:22px;background:var(--gold);color:#3a2a0c;padding:12px 28px;
  border-radius:999px;font-weight:700}
.revcard a:hover{background:var(--gold-soft)}

.serv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:18px;margin-top:40px}
.serv-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px 26px;
  border-top:4px solid var(--gold);transition:transform .14s,box-shadow .14s}
.serv-card:hover{transform:translateY(-4px);box-shadow:0 10px 26px rgba(22,40,63,.1)}
.serv-ico{width:52px;height:52px;border-radius:13px;display:flex;align-items:center;justify-content:center;
  font-size:26px;background:var(--cream-2);margin-bottom:14px}
.serv-card h3{font-size:19px;color:var(--navy);font-weight:700;margin-bottom:8px}
.serv-card p{color:var(--muted);font-size:14.5px}
.serv-card .tag{display:inline-block;margin-top:12px;font-size:13px;font-weight:700;color:var(--gold)}

.booking{background:var(--navy);color:var(--cream);border-radius:16px;padding:44px 34px;position:relative;overflow:hidden;text-align:center}
.booking:before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 88% 8%,rgba(200,150,62,.22),transparent 55%)}
.booking > *{position:relative;z-index:1}
.booking h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400;color:var(--gold-soft);font-size:clamp(26px,4vw,34px)}
.booking p.bk-sub{color:#cfd8e2;font-size:15.5px;max-width:36em;margin:10px auto 0}
.bksteps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:30px auto 0;max-width:760px}
@media(max-width:640px){.bksteps{grid-template-columns:repeat(2,1fr)}}
.bkstep{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:18px 10px}
.bkstep .n{font-family:"DM Serif Display",Georgia,serif;color:var(--gold-soft);font-size:24px;line-height:1}
.bkstep .t{font-size:13.5px;color:#cfd8e2;margin-top:6px}
.bkbtns{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:30px}
.bkbig{background:var(--gold);color:#3a2a0c;padding:16px 40px;border-radius:999px;font-weight:800;font-size:17px;display:inline-flex;align-items:center;gap:8px;transition:background .15s,transform .12s}
.bkbig:hover{background:var(--gold-soft);transform:translateY(-1px)}
.contactrow{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:26px}
.contactrow a{display:inline-flex;align-items:center;gap:8px;background:var(--cream);color:var(--navy);
  border:1px solid var(--line);border-radius:999px;padding:11px 22px;font-weight:700;font-size:14.5px}
.contactrow a:hover{border-color:var(--gold)}

footer{background:var(--navy);color:#a9b6c4;padding:38px 0;font-size:13.5px;margin-top:56px}
footer .brand-f{color:var(--gold-soft);font-family:"DM Serif Display",Georgia,serif;font-size:22px}
footer .spirit-f{color:#cfd8e2;margin:8px 0 14px}
footer .flinks{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:14px}
footer .flinks a{color:var(--gold-soft)}
footer .flinks a:hover{text-decoration:underline}
footer .legal{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1);color:#7f8d9c;font-size:12px}

.actionbar{position:fixed;bottom:0;left:0;right:0;z-index:40;display:grid;grid-template-columns:1fr 1fr 1fr;
  background:var(--navy);border-top:1px solid rgba(232,200,135,.25);padding-bottom:env(safe-area-inset-bottom)}
.actionbar a{padding:15px 2px;text-align:center;color:var(--cream);font-size:14px;font-weight:500;
  border-right:1px solid rgba(255,255,255,.1)}
.actionbar a:last-child{border-right:0}
.actionbar a.hi{background:var(--gold);color:#3a2a0c;font-weight:700}
@media(min-width:721px){.actionbar{display:none}}

@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
