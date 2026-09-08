import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS, CHIP, cisGundamBar, FS } from "@/app/admin/_components/cis";
import { grab591Bookmarklet } from "@/lib/grab591-source";

export const dynamic = "force-dynamic";

/**
 * 「591 一鍵抓資料」書籤安裝頁。
 *
 * 為什麼是書籤而不是伺服器去抓：591 詳情頁是 Vue 動態渲染的，
 * 伺服器抓只會拿到 ${price} 這種未替換的樣板（實測確認）。
 * 而且這樣抓取只發生在使用者自己已登入、自己正在看的那一頁，由他自己按下才執行。
 */
export default async function Grab591Page() {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="591 一鍵抓資料" callbackUrl="/admin/grab591" />;
  }

  const href = grab591Bookmarklet();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: CIS.bg,
        color: CIS.text,
        fontFamily: CIS.font,
        padding: "28px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link href="/admin/buyers" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
          ← 買方名單
        </Link>

        <h1 style={{ fontSize: FS(26), fontWeight: 800, margin: "12px 0 10px" }}>591 一鍵抓資料</h1>
        <div style={{ ...cisGundamBar, marginBottom: 20, maxWidth: 240 }} />

        {/* 安裝 */}
        <section
          style={{
            background: CIS.card,
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: "20px 22px",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: FS(15), fontWeight: 700, margin: "0 0 12px" }}>裝一次就好</h2>
          <p style={{ fontSize: FS(13.5), color: CIS.textSub, lineHeight: 1.85, margin: "0 0 14px" }}>
            先按 <strong>Ctrl+Shift+B</strong> 讓書籤列顯示出來，然後把下面這顆<strong>用滑鼠拖</strong>到書籤列上。
            <br />
            （不能用點的，點了不會有反應——它要被存成書籤才有用。）
          </p>

          <a
            href={href}
            draggable
            style={{
              display: "inline-block",
              padding: "13px 26px",
              borderRadius: CIS.radiusSm,
              background: CIS.blue,
              color: CIS.onAccent,
              fontSize: FS(15),
              fontWeight: 800,
              textDecoration: "none",
              cursor: "grab",
              boxShadow: "0 3px 10px rgba(30,91,198,0.3)",
            }}
          >
            🏠 抓這間 → 拖我到書籤列
          </a>
        </section>

        {/* 怎麼用 */}
        <section
          style={{
            background: CIS.card,
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: "20px 22px",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: FS(15), fontWeight: 700, margin: "0 0 12px" }}>怎麼用</h2>
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: FS(13.5), color: CIS.textSub, lineHeight: 2 }}>
            <li>
              在 591 打開<strong>物件詳情頁</strong>（搜尋結果列表按了沒用，要點進去那一間）
            </li>
            <li>按書籤列的「🏠 抓這間」</li>
            <li>跳出「✅ 已複製」就成功了</li>
            <li>
              回到買方明細 → 選 <strong>🔑 帶看</strong> 或 <strong>📤 推案</strong> → 貼進上面那個框
            </li>
            <li>社區名、地址、總價、坪數、房數、型態、車位、屋齡會自動填好</li>
          </ol>
        </section>

        {/* 界線 —— 這段要留著，日後有人問「為什麼不多抓一點」看這裡 */}
        <section
          style={{
            background: CHIP.warn.bg,
            border: `1px solid ${CHIP.warn.border}`,
            borderRadius: CIS.radius,
            padding: "18px 22px",
          }}
        >
          <h2 style={{ fontSize: FS(14), fontWeight: 700, margin: "0 0 10px", color: CHIP.warn.color }}>
            它抓什麼、不抓什麼
          </h2>
          <p style={{ fontSize: FS(13), color: CIS.textSub, lineHeight: 1.9, margin: "0 0 10px" }}>
            <strong>會抓（事實）</strong>：社區名、地址、總價、坪數、房數、型態、車位、屋齡、物件編號。
            這些是你帶看時本來就要跟客戶講的東西。
          </p>
          <p style={{ fontSize: FS(13), color: CIS.textSub, lineHeight: 1.9, margin: "0 0 10px" }}>
            <strong>不抓（別人做的東西）</strong>：標題的行銷文案（「獨家★…★」那種是別家仲介寫的）、
            物件照片（有浮水印，著作權不是我們的）、所屬公司與仲介聯絡方式。
            <strong>這正是你說的「其他人的資料」，全部不會進來。</strong>
          </p>
          <p style={{ fontSize: FS(12.5), color: CIS.textMute, lineHeight: 1.85, margin: 0 }}>
            ⚠️ 產出給客戶的資料一定會標「資料來源：591，實際以現場為準」。
            這一行同時擋掉資料過期，以及把別家的委託講成自己案子的風險——
            你可以說「我幫你篩出這幾間」，那是事實；不能說「這是我的委託案」。
          </p>
        </section>
      </div>
    </main>
  );
}
