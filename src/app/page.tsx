/**
 * / — 個人官網首頁（吳冠良．台中海線專業房仲）
 *
 * 形象照 → 客戶口碑 → 服務項目（每張卡直接連到對應工具）→ 免費工具 → 預約諮詢
 * 「預約」直接接到本站的線上預約系統 /card/booking（不再只是導去 LINE）。
 * 配色沿用品牌 CIS：深藍 #16283f / 金 #c8963e / 米 #f7f3ea
 */
import type { Metadata } from "next";
import Link from "next/link";
import { OWNER, SOCIAL } from "@/config/owner";
import { SITE_URL } from "@/lib/site";
import { agentNode, websiteNode } from "@/lib/agent-node";

const SITE_TITLE = "吳冠良｜台中海線專業房仲 - 資產配置・稅務諮詢・簡易裝潢｜懂你又懂房";
const SITE_DESC =
  "台中海線專業房仲吳冠良，善願必佑、站在客戶這一邊。提供資產配置、稅務諮詢、簡易裝潢，以及買方陪跑、賣方委託、土地買賣。服務沙鹿、清水、梧棲、龍井、大肚、大甲。Google 商家 5.0 星。線上預約諮詢。";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESC,
  keywords:
    "台中房仲,海線房仲,沙鹿房仲,清水房仲,梧棲房仲,龍井房仲,大肚房仲,大甲房仲,吳冠良,資產配置,稅務諮詢,簡易裝潢,土地買賣,委託賣屋,首購",
  authors: [{ name: OWNER.name }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "吳冠良｜台中海線專業房仲 - 讓你幸福會發光・懂你又懂房",
    description: "善願必佑、站在客戶這一邊。台中海線買賣、資產配置、稅務諮詢、簡易裝潢。Google 5.0 星。線上預約諮詢。",
    images: [OWNER.photoUrl],
    locale: "zh_TW",
  },
};

/**
 * 首頁是整個網站的「商家本體」，@id 固定為 <網址>/#agent。
 * 43 頁靜態內容頁的 JSON-LD 用同一個 @id 指回這裡（見 scripts/seo-build.mjs），
 * Google 才會把全站當成同一個商家、而不是 44 個不相干的實體。
 * 資料來源是 src/config/agent.json，兩邊共用，不要在這裡另外寫死。
 */
const JSON_LD = {
  "@context": "https://schema.org",
  // 節點形狀統一在 src/lib/agent-node.ts，部落格文章也用同一份。
  "@graph": [agentNode(), websiteNode()],
};

const CSS = `
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
.kicker.onDark{color:var(--gold-soft)}
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
@media(max-width:860px){.navlinks a:not(.pill){display:none}}

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
.serv-card{display:block;text-decoration:none;color:inherit;
  background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px 26px;
  border-top:4px solid var(--gold);transition:transform .14s,box-shadow .14s}
.serv-card:hover{transform:translateY(-4px);box-shadow:0 10px 26px rgba(22,40,63,.1);border-color:var(--gold)}
.serv-card:hover .tag{text-decoration:underline}
.serv-ico{width:52px;height:52px;border-radius:13px;display:flex;align-items:center;justify-content:center;
  font-size:26px;background:var(--cream-2);margin-bottom:14px}
.serv-card h3{font-size:19px;color:var(--navy);font-weight:700;margin-bottom:8px}
.serv-card p{color:var(--muted);font-size:14.5px}
.serv-card .tag{display:inline-block;margin-top:12px;font-size:13px;font-weight:700;color:var(--gold)}

/* 免費工具區 */
.tools{background:var(--cream-2);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.toolgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:38px}
.tool{display:block;background:#fff;border:1px solid var(--line);border-radius:13px;padding:19px 20px;
  transition:transform .14s,box-shadow .14s,border-color .14s}
.tool:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(22,40,63,.09);border-color:var(--gold)}
.tool-t{font-weight:700;color:var(--navy);font-size:16px;margin-bottom:3px}
.tool-d{font-size:13.5px;color:var(--muted);line-height:1.65}

/* 預約區：接到真正的預約系統 */
.booking{background:var(--navy);color:var(--cream);border-radius:16px;padding:44px 34px;position:relative;overflow:hidden}
.booking:before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 88% 8%,rgba(200,150,62,.22),transparent 55%)}
.bk-inner{position:relative;z-index:1;text-align:center}
.bk-inner h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400;color:var(--gold-soft);font-size:clamp(26px,4vw,34px)}
.bk-inner p.bk-sub{color:#cfd8e2;font-size:15.5px;max-width:34em;margin:8px auto 0}
.bksteps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:32px auto 0;max-width:760px}
@media(max-width:640px){.bksteps{grid-template-columns:repeat(2,1fr)}}
.bkstep{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:18px 10px}
.bkstep .n{font-family:"DM Serif Display",Georgia,serif;color:var(--gold);font-size:22px;line-height:1}
.bkstep .t{font-size:13.5px;color:#cfd8e2;margin-top:6px}
.bkbtns{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:32px}
.bkbig{background:var(--gold);color:#3a2a0c;padding:16px 40px;border-radius:999px;font-weight:800;font-size:17px;
  display:inline-flex;align-items:center;gap:8px;transition:background .15s,transform .12s}
.bkbig:hover{background:var(--gold-soft);transform:translateY(-1px)}
.bknote{position:relative;z-index:1;text-align:center;font-size:12.5px;color:#9fb0c0;margin-top:18px}
.contactrow{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:26px}
.contactrow a{display:inline-flex;align-items:center;gap:8px;background:var(--cream);color:var(--navy);
  border:1px solid var(--line);border-radius:999px;padding:11px 22px;font-weight:700;font-size:14.5px}
.contactrow a:hover{border-color:var(--gold)}

footer{background:var(--navy);color:#a9b6c4;padding:38px 0;font-size:13.5px;margin-top:56px}
footer .brand-f{color:var(--gold-soft);font-family:"DM Serif Display",Georgia,serif;font-size:22px}
footer .spirit-f{color:#cfd8e2;margin:8px 0 14px}
/* 頁尾連結原本只有 24px 高，手機上很難點準。拉到 40px（拇指的最小舒適區）。 */
footer .flinks{display:flex;flex-wrap:wrap;gap:2px 16px;margin-bottom:10px}
footer .flinks a{color:var(--gold-soft);display:inline-flex;align-items:center;
  min-height:40px;padding:0 2px;text-decoration:none}
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

/**
 * 每張服務卡片都直接連到對應的工具頁 —— 讀者不用捲到頁面下方的工具區再自己找。
 * tag 直接寫工具名稱，點下去會到哪裡一眼就知道，不用猜。
 */
const SERVICES = [
  { ic: "📊", h: "資產配置", p: "依你的資金、家庭階段與目標，規劃自住／收租／增值的房產布局，把每一分錢放對位置。", tag: "買方購屋成本試算", href: "/buyer-cost" },
  { ic: "🧾", h: "稅務諮詢", p: "房地合一、土增稅、贈與繼承、自住優惠…買賣前先算清楚，不讓稅費吃掉你的獲利。", tag: "房地合一稅・自用優惠", href: "/selfuse-tax" },
  { ic: "🛠️", h: "簡易裝潢", p: "老屋翻新、進場前小修繕、賣相優化，串接可信任的配合廠商，花小錢提升居住與成交價值。", tag: "漏水屋況檢查清單", href: "/leak-check" },
  { ic: "🏠", h: "買方全程陪跑", p: "需求規劃 → 看屋 → 議價 → 簽約 → 貸款 → 交屋驗屋，購屋 7 大關卡全程把關，怕買貴就找我。", tag: "買屋注意事項全攻略", href: "/buy-house-guide" },
  { ic: "🔑", h: "賣方委託銷售", p: "誠實定價、用心行銷，售屋網＋社群多管道曝光，替屋主找到對的買家、不亂喊價。", tag: "賣房前你必須知道的事", href: "/seller-guide" },
  { ic: "🌳", h: "土地買賣", p: "建地、農地買賣與委託，含產權、貸款與稅費相關諮詢，複雜地目也幫你講到懂。", tag: "申請建築線全攻略", href: "/building-line" },
];

/** 首頁露出的主打工具（完整 40 個在 /tools/） */
const TOOLS = [
  { ic: "🏦", name: "青安 3.0 試算機", url: "/qingan3/", desc: "新制三道門檻快篩，加上分段月付金試算。" },
  { ic: "🧮", name: "買方購屋成本試算", url: "/buyer-cost/", desc: "契稅、規費、代書費逐項列出，算出四階段付款金額。" },
  { ic: "💰", name: "賣房前必知", url: "/seller-guide/", desc: "開價策略、房地合一與土增稅試算、完整出售流程。" },
  { ic: "📜", name: "繼承・贈與稅試算", url: "/inheritance/", desc: "依財政部公告金額，算出扣除額與應納稅額。" },
  { ic: "💧", name: "漏水屋況檢查清單", url: "/leak-check/", desc: "看屋現場逐項打勾，共 32 項必看重點。" },
  { ic: "🗺️", name: "海線學區地圖", url: "/haixian-school-map/", desc: "查詢海線各區國中小學區範圍。" },
  { ic: "🏛️", name: "貸款成數與寬限期", url: "/loan-guide/", desc: "能貸幾成看什麼、寬限期的真相與陷阱。" },
  { ic: "🏗️", name: "自地自建全流程", url: "/self-build-guide/", desc: "買地、貸款、建照、監工到成本控管一次看。" },
];

const STEPS = [
  { n: "1", t: "選你要談什麼" },
  { n: "2", t: "挑日期時段" },
  { n: "3", t: "填聯絡資料" },
  { n: "4", t: "送出即成立" },
];

export default function Home() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* 導覽列 */}
      <nav>
        <div className="wrap">
          <a className="brand" href="#top">
            海線房仲冠良　<span>懂你又懂房</span>
          </a>
          <div className="navlinks">
            <a href="#services">服務項目</a>
            <a href="/tools/">免費工具</a>
            <a href="#record">客戶口碑</a>
            <Link href="/card">電子名片</Link>
            <Link className="pill" href="/card/booking">
              線上預約
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO：形象照 */}
      <header className="hero" id="top">
        <div className="wrap">
          <div className="herogrid">
            <div>
              <p className="eyebrow">台中海線・專業房地產顧問</p>
              <h1>
                我是 <em>{OWNER.alias}</em>
              </h1>
              <p className="lede">
                深耕台中海線的房地產顧問，把稅務、貸款、產權、屋況都替你查到清楚。善願必佑、站在客戶這一邊——懂你又懂房。
              </p>
              <p className="slogan">✦ 讓你幸福會發光</p>
              <ul className="checks">
                <li>專業把關，流程透明</li>
                <li>不推銷，只給誠實建議</li>
                <li>全程陪跑，站在你這一邊</li>
              </ul>
              <div className="herobtns">
                <Link className="btn gold" href="/card/booking">
                  📅 線上預約諮詢
                </Link>
                <a className="btn line" href={SOCIAL.line} target="_blank" rel="noopener noreferrer">
                  💬 加 LINE 詢問
                </a>
                <a className="btn ghost" href={`tel:${OWNER.phoneRaw}`}>
                  📞 {OWNER.phone}
                </a>
              </div>
            </div>
            <div className="disc">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={OWNER.photoUrl} alt={`台中海線專業房仲${OWNER.name} 形象照`} width={250} height={250} />
            </div>
          </div>
        </div>
      </header>

      {/* 客戶口碑 */}
      <section className="record" id="record">
        <div className="wrap center">
          <p className="kicker onDark">REVIEWS</p>
          <h2 className="title">客戶怎麼說</h2>
          <p className="lead">
            不靠自吹，讓評價說話。Google 商家目前維持 5.0 星滿分——客戶提到最多的兩件事：講解清楚、不逼你做決定。
          </p>
          <div className="revcard">
            <div className="big">5.0</div>
            <div className="stars">★★★★★</div>
            <div className="sub">Google 商家・真實評論</div>
            <a href="https://share.google/PCXhsE9UFI6zz1Afv" target="_blank" rel="noopener noreferrer">
              看 Google 評論 →
            </a>
          </div>
        </div>
      </section>

      {/* 服務項目 */}
      <section className="services" id="services">
        <div className="wrap">
          <div className="center">
            <p className="kicker">SERVICES</p>
            <h2 className="title">我提供的服務項目</h2>
            <p className="lead" style={{ margin: "6px auto 0" }}>
              從買到賣、從稅到裝潢，一次幫你想清楚。不只是仲介，更是你的房產顧問。
            </p>
          </div>
          <div className="serv-grid">
            {SERVICES.map((s) => (
              <Link className="serv-card" key={s.h} href={s.href}>
                <div className="serv-ico">{s.ic}</div>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
                <span className="tag">→ {s.tag}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 免費工具 —— 購屋攻略站 40 個試算與指南 */}
      <section className="tools" id="tools">
        <div className="wrap">
          <div className="center">
            <p className="kicker">FREE TOOLS</p>
            <h2 className="title">免費試算工具 ＆ 房產知識</h2>
            <p className="lead" style={{ margin: "6px auto 0" }}>
              買賣之前，先把數字算清楚。共 40 個試算機與完整指南，不用留資料就能用。
            </p>
          </div>
          <div className="toolgrid">
            {TOOLS.map((t) => (
              <a className="tool" href={t.url} key={t.url}>
                <div className="tool-t">
                  {t.ic} {t.name}
                </div>
                <div className="tool-d">{t.desc}</div>
              </a>
            ))}
          </div>
          <div className="center" style={{ marginTop: 28 }}>
            <a className="btn gold" href="/tools/">
              看全部 40 個工具與指南 →
            </a>
          </div>
        </div>
      </section>

      {/* 預約諮詢 —— 接到真正的預約系統 */}
      <section id="booking">
        <div className="wrap">
          <div className="booking">
            <div className="bk-inner">
              <p className="kicker" style={{ color: "var(--gold)" }}>
                BOOKING
              </p>
              <h2>約個時間，把你的狀況講清楚</h2>
              <p className="bk-sub">
                自己挑日期、自己選時段，送出就成立——不用來回傳訊息喬時間。
                預約完成後你會收到確認信，要改期或取消也能自己來。
              </p>
              <div className="bksteps">
                {STEPS.map((s) => (
                  <div className="bkstep" key={s.n}>
                    <div className="n">{s.n}</div>
                    <div className="t">{s.t}</div>
                  </div>
                ))}
              </div>
              <div className="bkbtns">
                <Link className="bkbig" href="/card/booking">
                  📅 開始線上預約
                </Link>
                <a className="btn ghost" href={SOCIAL.line} target="_blank" rel="noopener noreferrer">
                  💬 先用 LINE 問問看
                </a>
              </div>
              <p className="bknote">不推案、不催你，先把問題講清楚。你的資料只用來聯繫，不會外流。</p>
            </div>
          </div>
          <div className="contactrow">
            <a href={`tel:${OWNER.phoneRaw}`}>📞 {OWNER.phone}</a>
            <a href={SOCIAL.line} target="_blank" rel="noopener noreferrer">
              💬 LINE：wosawo
            </a>
            <Link href="/card">🪪 我的電子名片</Link>
            <a href="https://sales.myhomes.com.tw/0915295958" target="_blank" rel="noopener noreferrer">
              🏘️ 看我的物件
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div className="brand-f">海線房仲・{OWNER.name}</div>
          <div className="spirit-f">善願必佑 · 做對的事 · 站在客戶這一邊 · 讓你幸福會發光</div>
          <div className="flinks">
            <a href="#services">服務項目</a>
            <a href="#record">客戶口碑</a>
            <Link href="/card/booking">線上預約</Link>
            <Link href="/blog">房產筆記</Link>
            <Link href="/tools">買賣屋工具</Link>
            <Link href="/card">電子名片</Link>
            {SOCIAL.fb ? (
              <a href={SOCIAL.fb} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            ) : null}
            {SOCIAL.ig ? (
              <a href={SOCIAL.ig} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            ) : null}
          </div>
          服務沙鹿・清水・梧棲・龍井・大肚・大甲
          <br />
          {OWNER.phone}｜LINE：wosawo
          <div className="legal">
            本站資訊僅供參考，實際稅額、貸款條件與核貸額度以主管機關及承貸金融機構核定為準。© 2026 {OWNER.name}
          </div>
        </div>
      </footer>

      {/* 手機浮動列 */}
      <div className="actionbar">
        <a href={`tel:${OWNER.phoneRaw}`}>📞 電話</a>
        <Link href="/card/booking">📅 預約</Link>
        <a className="hi" href={SOCIAL.line} target="_blank" rel="noopener noreferrer">
          💬 LINE
        </a>
      </div>
    </>
  );
}
