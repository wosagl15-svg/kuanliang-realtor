/**
 * 通知佇列的排程入口。
 *
 * 實際的處理邏輯在 `@/lib/appointment-outbox`，因為現在有兩個地方會呼叫它：
 *   ① 建立／變更預約的當下（見 create、manage 路由的 after()）—— 這是主要路徑
 *   ② 這支 —— Vercel Cron 一天跑一次，補漏用
 *
 * 🔴 為什麼 cron 只剩一天一次：Vercel 免費方案的限制。本來設「每分鐘」，
 *    結果整個專案 deploy 被擋（Hobby accounts are limited to daily cron jobs）。
 *    通知的即時性改由 ① 負責，這支只負責撿掉漏掉的。
 *
 * 呼叫方式：
 *    GET /api/appointment/outbox            ← Vercel Cron 會自動帶授權標頭
 *    GET /api/appointment/outbox?key=<CRON_SECRET>   ← 手動觸發用
 *
 * 沒設 CRON_SECRET 時只允許 Vercel Cron 自己呼叫，避免被外面亂打。
 */
import { NextRequest, NextResponse } from "next/server";
import { drainAppointmentOutbox } from "@/lib/appointment-outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  // Vercel Cron 會帶 Authorization: Bearer <CRON_SECRET>
  if (secret && auth === `Bearer ${secret}`) return true;
  if (secret && req.nextUrl.searchParams.get("key") === secret) return true;
  // 沒設 CRON_SECRET：只信任 Vercel Cron 的識別標頭
  if (!secret && req.headers.get("x-vercel-cron")) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await drainAppointmentOutbox(20));
}
