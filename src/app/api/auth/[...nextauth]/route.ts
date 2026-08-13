/**
 * NextAuth 路由掛載點（2026-08-12）
 *
 * 🔴 這個檔案原本不存在 —— src/auth.ts 設定好了 NextAuth 並匯出 handlers，
 *    但沒有人把 handlers 掛到 /api/auth/*，所以：
 *      - /api/auth/signin 一直是 404
 *      - 登入永遠不會成功，後台永遠進不去
 *      - auth() 在 server component 裡拋錯 → /admin/* 回 500
 *    設了 AUTH_GOOGLE_ID / SECRET 也沒用，因為根本沒有端點接收 Google 的回呼。
 *
 * 掛上之後，next-auth 會自動提供這些路徑：
 *   /api/auth/signin            登入頁
 *   /api/auth/signin/google     直接跳 Google
 *   /api/auth/callback/google   Google 回呼（要跟 Cloud Console 的重新導向 URI 一致）
 *   /api/auth/signout           登出
 *   /api/auth/session           目前登入狀態
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
