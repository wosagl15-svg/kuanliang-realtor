/**
 * 頁首導覽圖（Chibi Business Manga v1）
 *
 * 為什麼要有這個：客戶多半用手機看，一進來就是一大片字會直接跳掉。
 * 先給一張「三秒看懂」的圖，願意往下才進正文，法條放最後面。
 *
 * 🔴 刻意「不」做成圖片檔，理由三個：
 *    ① 手機會自己排版，不會像 PNG 那樣縮到看不清字
 *    ② 文字是真的文字，Google 與 AI 讀得到（PNG 裡的字讀不到，
 *       等於花力氣整理的重點對 SEO 完全沒貢獻）
 *    ③ 改一個數字不用重做圖
 *
 * 🔴 角色是手寫 SVG，不是 AI 生圖。2026-08-29 實測 Canva 生圖會把
 *    指定的照片換成素材庫的陌生人、把繁體中文生成假字。手繪的每頁都一樣，
 *    不會漂移，換色也只要改 C 這個物件。
 *
 * 配色依 Chibi_Business_Manga_v1：底 #F4F6F9／主字 #0A2540／
 * 金 #E69C24／藍 #1A56B0。⚠️ 這組底色偏冷，內文區是暖米白 #f7f3ea，
 * 是刻意的對比，讓導覽圖看起來像「一張卡片」而不是內文的一部分。
 */
import type { NavFact, NavStep } from "@/lib/blog";

/** Q 版角色：2.5 頭身、短髮、眼鏡、西裝領帶。`mood` 只換嘴型。 */
export function Chibi({
  size = 96,
  mood = "smile",
}: {
  size?: number;
  mood?: "smile" | "think";
}) {
  return (
    <svg width={size} height={(size * 136) / 120} viewBox="0 0 120 136" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="130" rx="32" ry="5" fill="#DCE3EC" />
      {/* 西裝 */}
      <path d="M30 128c0-21 13-34 30-34s30 13 30 34z" fill="#1A56B0" />
      {/* 襯衫領口 */}
      <path d="M51 96l9 11 9-11 7 3-16 18-16-18z" fill="#fff" />
      {/* 領帶 */}
      <path d="M60 107l5 5-5 16-5-16z" fill="#E69C24" />
      {/* 頭 */}
      <circle cx="60" cy="54" r="35" fill="#FBE3D0" />
      {/* 頭髮 */}
      <path
        d="M25 52c0-19 16-33 35-33s35 14 35 33c0-9-9-14-17-12-6 2-10-4-18-4-9 0-13 5-21 5-8 0-14 4-14 11z"
        fill="#3A4250"
      />
      {/* 眼鏡 */}
      <g fill="#fff" stroke="#0A2540" strokeWidth="3">
        <circle cx="46" cy="56" r="10.5" />
        <circle cx="74" cy="56" r="10.5" />
      </g>
      <path d="M56.5 56h7" stroke="#0A2540" strokeWidth="3" />
      <circle cx="46" cy="57" r="3.8" fill="#0A2540" />
      <circle cx="74" cy="57" r="3.8" fill="#0A2540" />
      {/* 嘴 */}
      {mood === "smile" ? (
        <path d="M53 72q7 8 14 0" fill="none" stroke="#0A2540" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M54 73h12" stroke="#0A2540" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* 腮紅 */}
      <ellipse cx="34" cy="67" rx="5" ry="3" fill="#F6B9A0" />
      <ellipse cx="86" cy="67" rx="5" ry="3" fill="#F6B9A0" />
    </svg>
  );
}

export default function NavMap({ facts, steps }: { facts: NavFact[]; steps: NavStep[] }) {
  if (steps.length === 0 && facts.length === 0) return null;

  return (
    <section className="navmap" aria-label="這篇文章的重點導覽">
      <div className="nm-hd">
        <div>
          <span className="nm-tag">3 秒看懂</span>
          <h2 className="nm-h">這篇在講什麼</h2>
        </div>
        <Chibi size={78} />
      </div>

      {facts.length > 0 && (
        <div className="nm-facts">
          {facts.map((f) => (
            <div className="nm-fact" key={f.k + f.v}>
              <b>{f.v}</b>
              <span>{f.k}</span>
            </div>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <ol className="nm-steps">
          {steps.map((s, i) => {
            const inner = (
              <>
                <span className="nm-n">{i + 1}</span>
                <span className="nm-b">
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
                {s.to ? <a href={`#${s.to}`}>{inner}</a> : <span className="nm-static">{inner}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
