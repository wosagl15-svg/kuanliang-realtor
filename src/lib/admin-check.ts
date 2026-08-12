/**
 * 後台權限檢查 —— 只有白名單信箱過得了。
 *
 * 名單設在 `.env.local` 的 `ADMIN_EMAILS`（逗號分隔可多組）。
 */
import { auth, adminEmails } from "@/auth";

export type AdminCheckArgs = {
  email: string;
  userId: string;
};

export async function getAdminCheckArgs(): Promise<AdminCheckArgs> {
  const session = await auth();
  const u = (session?.user || {}) as { email?: string; id?: string };
  return { email: u.email || "", userId: u.id || "" };
}

/**
 * 當前登入者是不是管理員。
 *
 * 🔴 沒設白名單時回 false（不是 true）—— 忘了設定的後果應該是「進不去」，
 *    不是「全世界都進得去」。
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  /**
   * 🔧 本機預覽用後門（2026-08-12 加）
   *
   * 只有「同時」滿足兩個條件才成立：
   *   ① NODE_ENV === "development"（也就是 npm run dev，本機開發）
   *   ② .env.local 裡明確寫 DEV_ADMIN_BYPASS="1"
   *
   * 正式部署會跑 next build / next start，NODE_ENV 是 production，
   * 這段永遠不會生效 —— 就算旗標忘了拿掉，線上後台也不會被打開。
   */
  if (process.env.NODE_ENV === "development" && process.env.DEV_ADMIN_BYPASS === "1") {
    return true;
  }

  // 🔴 2026-08-12：auth() 在「AUTH_GOOGLE_ID / SECRET 沒設」時會拋錯，
  //    導致整個 /admin/* 回 500 白畫面，看不出是「沒登入」還是「系統壞了」。
  //    這裡吞掉例外並回 false —— 失敗一律當成「沒權限」，畫面顯示請登入。
  //    fail closed：拋錯時絕不放行。
  try {
    const { email } = await getAdminCheckArgs();
    if (!email) return false;
    const list = adminEmails();
    if (list.length === 0) return false;
    return list.includes(email.toLowerCase());
  } catch (e) {
    console.error("[admin-check] auth 失敗（多半是 AUTH_GOOGLE_* 未設定）:", e);
    return false;
  }
}
