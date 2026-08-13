/**
 * 後台登入 —— Google 帳號登入，白名單制。
 *
 * 只有 `ADMIN_EMAILS` 裡列出的信箱能進 `/admin/appointments`。
 * 前台名片與預約表單不需要登入，這裡純粹是後台的門。
 *
 * 沒設定 `AUTH_*` 也不會壞：前台照常運作，只是後台進不去。
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/** 允許進後台的信箱（.env 用逗號分隔多組） */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || process.env.APPOINTMENT_ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
  ],
  callbacks: {
    /**
     * 🔴 白名單擋在登入這一關，不是等進了後台才擋 ——
     *    不在名單裡的人連 session 都拿不到。
     */
    async signIn({ user }) {
      const list = adminEmails();
      if (list.length === 0) return false; // 沒設白名單 = 誰都不准進，比誰都能進安全
      return list.includes((user.email || "").toLowerCase());
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = String(token.sub || "");
      }
      return session;
    },
  },
  // ⚠️ 這裡原本有 `pages: { signIn: "/api/auth/signin" }` —— 已於 2026-08-12 移除。
  //    pages.signIn 是用來指定「自訂登入頁」的，把它指向 Auth.js 內建路由本身，
  //    等於叫它「別用內建頁，去這個自訂頁」，而那個自訂頁又是它自己 → 畫面全白、登不進去。
  //    不設這個欄位，Auth.js 就會渲染內建登入頁（含 Google 按鈕），這才是要的行為。
});
