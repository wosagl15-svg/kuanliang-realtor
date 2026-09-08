/**
 * 圖卡組（Chibi_Business_Manga_v1）
 *
 * 🔴 2026-08-29 冠良回饋：只放一張導覽圖不夠 ——
 *    「圖卡要做到能講解清楚，超過一張可以」。
 *    所以整段解說都由卡片承載，文字段落只留給法條與查證。
 *    一張卡講一件事；讀者看完卡片就該懂，往下是給要查依據的人看的。
 *
 * 🔴 手寫 SVG，不用 AI 生圖。2026-08-29 實測 Canva 生圖會把指定的
 *    本人照片換成素材庫的陌生人、把繁體中文生成假字、把數字截斷。
 *    手繪的每一頁都一樣，不會漂移，換色只要改 Chibi 裡的填色。
 *
 * 配色：底 #F4F6F9／字 #0A2540／金 #E69C24／藍 #1A56B0
 */
import type { Card } from "@/lib/blog";
import { Chibi } from "./NavMap";

/* ── 小圖示：每張關卡卡片左邊那顆 ────────────────────────── */
function StepIcon({ i }: { i: number }) {
  // ⚠️ 只放描邊，不要在這裡放 fill —— 展開時會蓋掉各自的底色
  const line = { stroke: "#0A2540", strokeWidth: 2.5 } as const;
  return (
    <svg className="ck-ic" width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill={i % 2 ? "#EDF1F7" : "#FFF6E6"} {...line} />
      {i === 0 && (
        <>
          <path d="M15 30V19M22 30V15M29 30V22M36 30V17" stroke="#1A56B0" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M11 34h26" stroke="#0A2540" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {i === 1 && (
        <>
          <circle cx="18" cy="20" r="5" fill="#1A56B0" />
          <circle cx="30" cy="20" r="5" fill="#E69C24" />
          <path d="M11 34c0-5 3-8 7-8s7 3 7 8M23 34c0-5 3-8 7-8s7 3 7 8" fill="none" {...line} />
        </>
      )}
      {i >= 2 && (
        <>
          <path d="M24 11v13l8 5" stroke="#0A2540" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <circle cx="24" cy="24" r="2.6" fill="#E69C24" />
        </>
      )}
    </svg>
  );
}

function Tick() {
  return (
    <svg className="ck-m" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#E69C24" stroke="#0A2540" strokeWidth="2" />
      <path d="M7 12.5l3.5 3.5L17 9" fill="none" stroke="#0A2540" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CardDeck({ cards }: { cards: Card[] }) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="deck">
      {cards.map((c, ci) => {
        /* ── 關鍵數字 ── */
        if (c.type === "facts") {
          return (
            <section className="ck ck-facts" key={ci} aria-label="關鍵數字">
              {c.items.map((f, i) => (
                <div className="ck-fact" key={f.k + f.v}>
                  <b className={i === 0 ? "hot" : ""}>{f.v}</b>
                  <span>{f.k}</span>
                </div>
              ))}
            </section>
          );
        }

        /* ── 編號關卡 ── */
        if (c.type === "steps") {
          return (
            <section className="ck ck-steps" key={ci}>
              <div className="ck-hd">
                <span className="ck-dot">{c.items.length}</span>
                <div>
                  <h2>{c.title || "三秒看懂"}</h2>
                  {c.sub && <p>{c.sub}</p>}
                </div>
                <Chibi size={62} />
              </div>
              <ol>
                {c.items.map((s, i) => {
                  const inner = (
                    <>
                      <span className="ck-n">{i + 1}</span>
                      <StepIcon i={i} />
                      <span className="ck-b">
                        <b>
                          {s.step && <em>{s.step}</em>}
                          {s.title}
                        </b>
                        {s.desc && <span>{s.desc}</span>}
                      </span>
                    </>
                  );
                  return (
                    <li key={s.title}>
                      {s.to ? <a href={`#${s.to}`}>{inner}</a> : <span className="ck-static">{inner}</span>}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        }

        /* ── 錯誤說法 vs 正解 ── */
        if (c.type === "myth") {
          return (
            <section className="ck ck-myth" key={ci}>
              <div className="ck-hd">
                <span className="ck-dot x">✕</span>
                <div>
                  <h2>{c.title || "這裡最多人搞錯"}</h2>
                </div>
              </div>
              <div className="ck-myth-bd">
                <Chibi size={84} mood="think" />
                <div>
                  <p className="ck-wrong">✕　{c.wrong}</p>
                  <ul className="ck-check">
                    {c.rights.map((r) => (
                      <li key={r}>
                        <Tick />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  {c.punch && <p className="ck-punch">{c.punch}</p>}
                </div>
              </div>
            </section>
          );
        }

        /* ── 死線／警示 ── */
        if (c.type === "warn") {
          return (
            <section className="ck ck-warn" key={ci}>
              <div className="ck-warn-bn">{c.title || "錯過就沒了"}</div>
              <div className="ck-warn-bd">
                {c.lead && <p className="ck-lead">{c.lead}</p>}
                <ul>
                  {c.items.map((f) => (
                    <li key={f.k + f.v}>
                      <b>{f.k}</b>
                      <span>{f.v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        }

        /* ── 金句 ── */
        if (c.type === "quote") {
          const [head, tail] = c.hl ? c.text.split(c.hl) : [c.text, ""];
          return (
            <section className="ck ck-quote" key={ci}>
              <div className="ck-quote-bn">{c.label || "一句話記住"}</div>
              <div className="ck-quote-bd">
                <p>
                  {head}
                  {c.hl && <span className="k">{c.hl}</span>}
                  {tail}
                </p>
              </div>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
