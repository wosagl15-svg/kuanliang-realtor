/**
 * 後台未登入畫面（2026-08-12）
 *
 * 原本各頁只印一行「需要登入」，沒有任何可以按的東西 ——
 * 使用者看到那句話也不知道要去哪登入。這裡給一顆真的按鈕。
 *
 * callbackUrl 讓登入完直接回到原本要去的頁面，不用再點一次。
 */
import { CIS, FS } from "@/app/admin/_components/cis";

export default function RequireLogin({
  title = "買方資料庫",
  callbackUrl = "/admin/buyers",
}: {
  title?: string;
  callbackUrl?: string;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: CIS.bg,
        color: CIS.text,
        fontFamily: CIS.font,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: CIS.card,
          border: `1px solid ${CIS.cardBorder}`,
          borderRadius: CIS.radius,
          padding: "34px 30px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: FS(30), marginBottom: 12 }}>🔐</div>
        <h1 style={{ fontSize: FS(19), fontWeight: 800, margin: "0 0 8px" }}>{title}</h1>
        <p style={{ fontSize: FS(13), color: CIS.textSub, margin: "0 0 22px", lineHeight: 1.8 }}>
          這裡有客戶的姓名與電話，需要登入才能查看。
        </p>

        {/* ⚠️ 一定要連「登入頁」而不是 /api/auth/signin/google —— Auth.js v5 的
            provider 端點只收帶 CSRF token 的 POST，用 <a> 走 GET 會被導到
            /api/auth/error?error=Configuration，看起來像設定壞掉其實不是。 */}
        <a
          href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          style={{
            display: "block",
            padding: "12px 20px",
            borderRadius: CIS.radiusSm,
            background: CIS.blue,
            color: CIS.onAccent,
            fontWeight: 700,
            fontSize: FS(14),
            textDecoration: "none",
          }}
        >
          用 Google 帳號登入
        </a>

        <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "18px 0 0", lineHeight: 1.8 }}>
          只有白名單內的信箱進得來。
          <br />
          第一次登入 Google 會顯示「未經驗證」警告，
          <br />
          點「進階 → 繼續前往」即可。
        </p>
      </div>
    </main>
  );
}
