/**
 * 通知佇列的「工人」—— 把 appointment_outbox 裡待辦的通知真的送出去。
 *
 * 🔴 為什麼需要這支：
 *    2026-08-12 查到通知信沒寄出，原因不是寄信失敗，而是
 *    建立預約時只把任務「排進 appointment_outbox」，
 *    但整個專案沒有任何程式去消化那個佇列（attempts 一直是 0）。
 *
 * 🔴 2026-08-27 從 `api/appointment/outbox/route.ts` 搬出來變成共用函式。
 *    原因：Vercel 免費方案的 Cron 一天只能跑一次，本來設成「每分鐘」，
 *    結果**整個專案都推不上線**（deploy 直接被擋）。
 *    改成「建立／變更預約的當下就自己跑一次」，cron 降成一天一次當補漏網——
 *    通知一樣即時，不用付費，也不必靠外部排程服務。
 *
 *    呼叫端有兩個：
 *      ① API 路由用 next/server 的 after() 在回應送出後跑（見 create / manage）
 *      ② GET /api/appointment/outbox（Vercel Cron 或帶 ?key= 手動觸發）
 */
import {
  listDueAppointmentOutbox,
  claimAppointmentOutbox,
  finishAppointmentOutbox,
  getAppointment,
  type AppointmentOutboxRow,
} from "@/lib/appointment";
import { LEGACY_DEFAULT_DURATION_MIN, type MeetLocation } from "@/lib/appointment-constants";
import {
  notifyNewAppointment,
  notifyAppointmentChange,
  type NotifyInput,
} from "@/lib/appointment-notify";

type Appointment = NonNullable<Awaited<ReturnType<typeof getAppointment>>>;

/** 資料庫欄位（snake_case）轉成通知函式要的格式，與 manage/route.ts 同一套規則 */
function parseIntent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((i) => typeof i === "string") : [];
  } catch {
    return [];
  }
}

function parseMeetLocation(raw: string | null): MeetLocation | null {
  if (!raw) return null;
  try {
    const loc = JSON.parse(raw) as Partial<MeetLocation>;
    if (!loc.name) return null;
    return {
      name: String(loc.name).slice(0, 120),
      address: String(loc.address || "").slice(0, 200),
      lat: typeof loc.lat === "number" ? loc.lat : null,
      lng: typeof loc.lng === "number" ? loc.lng : null,
      placeId: typeof loc.placeId === "string" ? loc.placeId.slice(0, 200) : null,
      source: loc.source === "google" ? "google" : "manual",
    };
  } catch {
    return null;
  }
}

function toNotifyInput(a: Appointment): NotifyInput {
  const start = new Date(a.slot_at);
  return {
    id: a.id,
    name: a.name,
    gender: a.gender,
    phone: a.phone,
    email: a.email,
    lineId: a.line_id,
    meetType: a.meet_type,
    meetLocation: parseMeetLocation(a.meet_location),
    intent: parseIntent(a.intent),
    urgency: a.urgency,
    note: a.note,
    slotAt: start,
    slotEndAt: a.slot_end_at
      ? new Date(a.slot_end_at)
      : new Date(start.getTime() + LEGACY_DEFAULT_DURATION_MIN * 60_000),
    aiHeat: a.ai_heat,
    aiSuggestion: a.ai_suggestion,
    meetUrl: a.meet_url,
    status: a.status,
  };
}

/** 這支只處理「通知」類型；日曆與 AI 評分屬於選配功能，沒設定就跳過不重試。 */
const NOTIFY_TASKS = new Set(["notify_new", "notify_reschedule", "notify_cancel"]);

async function runTask(row: AppointmentOutboxRow): Promise<void> {
  if (!NOTIFY_TASKS.has(row.task_type)) {
    // 非通知類（ai_grade / calendar_*）：這支不負責，直接標完成免得卡住佇列
    await finishAppointmentOutbox(row.id, null);
    return;
  }

  const appointment = await getAppointment(row.appointment_id);
  if (!appointment) {
    await finishAppointmentOutbox(row.id, "找不到對應的預約");
    return;
  }

  let payload: { phase?: "confirmation_request" | "confirmed" } = {};
  if (row.payload_json) {
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      /* payload 壞掉就用預設值，不要因此卡住通知 */
    }
  }

  const notifyInput = toNotifyInput(appointment);

  if (row.task_type === "notify_new") {
    await notifyNewAppointment(notifyInput, {
      onlyPending: true,
      phase: payload.phase || "confirmed",
    });
  } else {
    await notifyAppointmentChange(notifyInput, {
      type: row.task_type === "notify_cancel" ? "cancel" : "reschedule",
    });
  }

  await finishAppointmentOutbox(row.id, null);
}

export type OutboxDrainResult = {
  total: number;
  done: number;
  failed: number;
  skipped: number;
  details: string[];
};

/**
 * 消化佇列裡到期的任務。
 *
 * ⚠️ 這支**絕對不能往外拋例外**。它會在 after() 裡跑，
 *    在那裡爆掉不會讓使用者看到錯誤，只會讓通知默默不見。
 *    單一任務失敗就記在該筆的 last_error 上，繼續跑下一筆。
 */
export async function drainAppointmentOutbox(limit = 20): Promise<OutboxDrainResult> {
  const result: OutboxDrainResult = { total: 0, done: 0, failed: 0, skipped: 0, details: [] };

  let due: AppointmentOutboxRow[];
  try {
    due = await listDueAppointmentOutbox(limit);
  } catch (e) {
    console.error("[appointment/outbox] 讀取佇列失敗", e);
    return result;
  }
  result.total = due.length;

  for (const row of due) {
    let claimed = false;
    try {
      claimed = await claimAppointmentOutbox(row.id);
    } catch (e) {
      console.error("[appointment/outbox] 認領失敗", row.id, e);
    }
    if (!claimed) {
      result.skipped += 1; // 另一個執行緒已經搶走了
      continue;
    }
    try {
      await runTask(row);
      result.done += 1;
      result.details.push(`${row.task_type} ok`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[appointment/outbox] 任務失敗", row.id, row.task_type, msg);
      await finishAppointmentOutbox(row.id, msg.slice(0, 500)).catch(() => {});
      result.failed += 1;
      result.details.push(`${row.task_type} 失敗：${msg.slice(0, 120)}`);
    }
  }

  return result;
}
