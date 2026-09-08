/**
 * 每日工作台 /admin/today（2026-08-22）
 *
 * 為什麼要獨立一頁，預約管理不是已經有「今日行程」了嗎：
 *   預約管理是「案件視角」——它回答的是「這個客戶怎麼樣了」。
 *   但早上八點半打開電腦要問的其實是另一個問題：**今天要做什麼、依什麼順序做。**
 *   那需要把三種不見得同源的東西擺在同一張紙上：
 *     ① 今天幾點要見誰（預約）
 *     ② 今天要跑哪幾個點（實體拜訪，順路才排得動）
 *     ③ 沒人會提醒的每日固定動作（開發、屋主回報、日報）
 *   分散在三個地方時，第③項永遠是被犧牲掉的那個。
 *
 * 每張約都直接把「追蹤連結」攤開（撥號／導航／改約連結／填結果），
 * 是因為現場最花時間的不是做事，是找那個連結在哪。
 */

import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import {
  listAppointments,
  intentEmoji,
  intentLabel,
  meetTypeEmoji,
  meetTypeLabel,
  urgencyEmoji,
  urgencyLabel,
  type MeetLocation,
} from "@/lib/appointment";
import type { AppointmentRow } from "@/lib/appointment-constants";
import {
  appointmentMapsUrl,
  appointmentLocationText,
  buildAppointmentCalendarUrl,
} from "@/lib/appointment-notify";
import { createAppointmentManageToken } from "@/lib/appointment-token";
import { listDormantBuyers, type BuyerListItem } from "@/lib/buyer";
import {
  caseSideOf,
  SIDE_META,
  buyerIntakeHref,
  sellerIntakeHref,
  buyerLookupHref,
  sellerLookupHref,
  type CaseSide,
} from "@/lib/appointment-side";
import { listReportDueSellers, daysSinceReport, type SellerRow } from "@/lib/seller";
import { sellerStageLabel, motiveLabel, REPORT_DUE_DAYS } from "@/lib/seller-constants";
import { OWNER, SITE_URL } from "@/config/owner";
// owner 的 SITE_URL 是通知信在用的 APPOINTMENT_BASE_URL（要跟寄出去的連結一致，改約 token 才對得上）；
// 「發給客戶的預約頁」則要用對外的正式主域名，兩者不是同一件事，不能混用。
import { absoluteUrl } from "@/lib/site";
import { districtLabel } from "@/lib/buyer-constants";
import { CIS, CHIP, FS, cisGundamBar, type ChipTone } from "@/app/admin/_components/cis";
import { DAILY_BLOCKS, tasksForWeekday, taipeiDateKey, taipeiWeekday } from "@/lib/daily-tasks";
import DailyChecklist from "./DailyChecklist";
import CopyLink from "./CopyLink";

export const dynamic = "force-dynamic";

const TW_OFFSET_MS = 8 * 60 * 60_000;

/** 這幾種見面方式要出門，才算實體拜訪；phone / video 不用排路線 */
const IN_PERSON_MEET_TYPES = new Set(["office", "hq", "studio", "custom"]);

const CONTACT_LABELS: Record<string, string> = {
  uncontacted: "尚未聯絡",
  contacted: "已聯絡",
  waiting_customer: "等待客戶",
  followup_due: "待跟進",
  closed: "已結案",
};

function twTime(value: Date): string {
  const tw = new Date(new Date(value).getTime() + TW_OFFSET_MS);
  return `${String(tw.getUTCHours()).padStart(2, "0")}:${String(tw.getUTCMinutes()).padStart(2, "0")}`;
}

function twDateLabel(now: Date): string {
  const tw = new Date(now.getTime() + TW_OFFSET_MS);
  const wd = ["日", "一", "二", "三", "四", "五", "六"][tw.getUTCDay()];
  return `${tw.getUTCFullYear()}/${String(tw.getUTCMonth() + 1).padStart(2, "0")}/${String(tw.getUTCDate()).padStart(2, "0")}（週${wd}）`;
}

function isSameTaipeiDay(a: Date, b: Date): boolean {
  return taipeiDateKey(new Date(a)) === taipeiDateKey(b);
}

function parseIntents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** 買方的 districts 存的是 JSON 字串（["qingshui"]），直接印出來人看不懂 */
function districtNames(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((k) => districtLabel(String(k))).join("、") : "";
  } catch {
    return "";
  }
}

function parseMeetLocation(raw: string | null): MeetLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MeetLocation>;
    return parsed && typeof parsed.name === "string" ? (parsed as MeetLocation) : null;
  } catch {
    return null;
  }
}

/**
 * 客戶自助改約／取消連結。沒設 APPOINTMENT_TOKEN_SECRET 時簽不出來，
 * 回 null 讓那顆按鈕不要出現——不能讓整頁因為這個掛掉。
 */
function manageUrl(row: AppointmentRow): string | null {
  if (!row.email) return null;
  try {
    return `${SITE_URL}/card/booking/manage?token=${encodeURIComponent(createAppointmentManageToken(row.id, row.email))}`;
  } catch {
    return null;
  }
}

function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const c = CHIP[tone];
  return (
    <span
      style={{
        fontSize: FS(10),
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function LinkPill({ href, children, tone }: { href: string; children: React.ReactNode; tone?: "primary" }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      style={{
        fontSize: FS(11),
        fontWeight: 700,
        padding: "5px 11px",
        borderRadius: 999,
        textDecoration: "none",
        whiteSpace: "nowrap",
        border: `1px solid ${tone === "primary" ? CIS.blue : CIS.cardBorder}`,
        background: tone === "primary" ? CIS.blue : CIS.card,
        color: tone === "primary" ? CIS.onAccent : CIS.textSub,
      }}
    >
      {children}
    </a>
  );
}

/**
 * 談完之後的分流：買方線推去買方資料庫、賣方線推去物件庫。
 *
 * 為什麼放在卡片裡而不是另開一頁：見完面的那個當下最記得細節，
 * 只要多按一次「回到後台再找那個人」，八成就不會建了。
 */
function SideRouting({ row, side, highlight }: { row: AppointmentRow; side: CaseSide; highlight: boolean }) {
  const showBuyer = side === "buyer" || side === "both" || side === "unknown";
  const showSeller = side === "seller" || side === "both" || side === "unknown";

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: `1px dashed ${CIS.panelBorder}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: FS(11), fontWeight: 800, color: highlight ? CIS.red : CIS.textMute }}>
          {highlight ? "談完了 → 現在就歸檔：" : "談完之後歸到："}
        </span>
        {showBuyer && (
          <LinkPill href={buyerIntakeHref(row)} tone={highlight && side !== "unknown" ? "primary" : undefined}>
            🏠 建進買方資料庫
          </LinkPill>
        )}
        {showSeller && (
          <LinkPill href={sellerIntakeHref(row)} tone={highlight && side !== "unknown" ? "primary" : undefined}>
            🏷️ 建成委託物件
          </LinkPill>
        )}
        {showBuyer && <LinkPill href={buyerLookupHref(row)}>🔎 查買方建過沒</LinkPill>}
        {showSeller && <LinkPill href={sellerLookupHref(row)}>🔎 查屋主建過沒</LinkPill>}
      </div>
      {side === "unknown" && (
        <div style={{ fontSize: FS(10), color: CIS.textMute, marginTop: 5 }}>
          這場約看不出是買還是賣（意圖沒勾、備註也沒提）。談完先確認他是要買還是要賣，再選上面其中一邊。
        </div>
      )}
      {side === "both" && (
        <div style={{ fontSize: FS(10), color: CIS.textMute, marginTop: 5 }}>
          換屋客：兩邊都要建。只建一邊的話，他賣掉之後你就接不到他的買方需求了。
        </div>
      )}
    </div>
  );
}

/** 一場約的完整卡片：誰、幾點、在哪，以及所有會用到的連結 */
function AppointmentCard({ row, now, order }: { row: AppointmentRow; now: Date; order?: number }) {
  const slot = new Date(row.slot_at);
  const location = parseMeetLocation(row.meet_location);
  const maps = appointmentMapsUrl(row.meet_type, location);
  const locText = appointmentLocationText(row.meet_type, location);
  const intents = parseIntents(row.intent);
  const manage = manageUrl(row);
  const calUrl = buildAppointmentCalendarUrl({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    meetType: row.meet_type,
    meetLocation: location,
    slotAt: slot,
    slotEndAt: row.slot_end_at,
    meetUrl: row.meet_url,
    note: row.note,
  });
  const past = slot.getTime() < now.getTime();
  const uncontacted = (row.contact_status || "uncontacted") === "uncontacted";
  const needsOutcome = past && ["confirmed", "completed"].includes(row.status) && (!row.outcome_status || row.outcome_status === "none");
  const side = caseSideOf(row);

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: 14,
        borderRadius: CIS.radiusSm,
        background: past ? CIS.panel : CIS.card,
        border: `1px solid ${needsOutcome ? CHIP.warn.border : CIS.cardBorder}`,
      }}
    >
      {/* 時間欄 */}
      <div style={{ width: 62, flexShrink: 0, textAlign: "center" }}>
        {order !== undefined && (
          <div
            style={{
              fontSize: FS(10),
              fontWeight: 800,
              color: CIS.onAccent,
              background: CIS.blueDeep,
              borderRadius: 999,
              padding: "1px 0",
              marginBottom: 4,
            }}
          >
            第 {order} 站
          </div>
        )}
        <div style={{ fontSize: FS(18), fontWeight: 800, color: past ? CIS.textMute : CIS.blueDeep, fontVariantNumeric: "tabular-nums" }}>
          {twTime(slot)}
        </div>
        {row.slot_end_at && (
          <div style={{ fontSize: FS(10), color: CIS.textMute, fontVariantNumeric: "tabular-nums" }}>
            ─ {twTime(new Date(row.slot_end_at))}
          </div>
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: FS(15), fontWeight: 800 }}>{row.name}</span>
          {row.case_no && (
            <span style={{ fontSize: FS(10), color: CIS.textMute, fontVariantNumeric: "tabular-nums" }}>{row.case_no}</span>
          )}
          <Chip tone={side === "unknown" ? "neutral" : side === "seller" ? "warn" : "info"}>
            {SIDE_META[side].emoji} {SIDE_META[side].label}
          </Chip>
          {row.status === "pending_confirmation" && <Chip tone="warn">待客戶確認</Chip>}
          {uncontacted && <Chip tone="danger">還沒聯絡</Chip>}
          {needsOutcome && <Chip tone="warn">結束了，還沒填結果</Chip>}
          {row.urgency && (
            <Chip tone={row.urgency === "asap" ? "danger" : "neutral"}>
              {urgencyEmoji(row.urgency)} {urgencyLabel(row.urgency)}
            </Chip>
          )}
        </div>

        <div style={{ fontSize: FS(12), color: CIS.textSub, marginTop: 4 }}>
          {meetTypeEmoji(row.meet_type)} {meetTypeLabel(row.meet_type)}
          {locText ? `・${locText}` : ""}
          {intents.length ? `・想談 ${intents.map((i) => `${intentEmoji(i)}${intentLabel(i)}`).join("、")}` : ""}
        </div>

        {row.note && (
          <div
            style={{
              fontSize: FS(11),
              color: CIS.textSub,
              marginTop: 6,
              padding: "6px 10px",
              background: CIS.panel,
              border: `1px solid ${CIS.panelBorder}`,
              borderRadius: 8,
              whiteSpace: "pre-wrap",
            }}
          >
            📌 {row.note}
          </div>
        )}

        {/* 追蹤連結：出門前 / 現場 / 結束後都在這一排 */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {row.phone && <LinkPill href={`tel:${row.phone.replace(/[^0-9+]/g, "")}`} tone="primary">📞 打給他</LinkPill>}
          {maps && <LinkPill href={maps}>🗺️ 導航</LinkPill>}
          {row.meet_url && <LinkPill href={row.meet_url}>💻 視訊連結</LinkPill>}
          {row.email && <LinkPill href={`mailto:${row.email}`}>✉️ Email</LinkPill>}
          <LinkPill href={calUrl}>📅 加到日曆</LinkPill>
          {manage && <CopyLink value={manage} label="🔗 複製改約連結" title="客戶可自行改期／取消，貼給他就好" />}
          {row.phone && <CopyLink value={row.phone} label="📋 複製電話" />}
          <LinkPill href={`/admin/appointments?q=${encodeURIComponent(row.case_no || row.name)}`}>
            ⚙️ 案件詳情／填結果
          </LinkPill>
        </div>

        {row.line_id && (
          <div style={{ fontSize: FS(10), color: CIS.textMute, marginTop: 6 }}>LINE：{row.line_id}</div>
        )}

        {/* 談完之後往哪走：買方進資料庫、賣方進物件庫。見面前也看得到，可以先查有沒有建過。 */}
        <SideRouting row={row} side={side} highlight={past} />
      </div>
    </div>
  );
}

/** 一行式的待辦（跟進佇列用），不需要整張卡片那麼重 */
function TaskRow({ row, reason, tone }: { row: AppointmentRow; reason: string; tone: ChipTone }) {
  const side = caseSideOf(row);
  const intake =
    side === "seller"
      ? { href: sellerIntakeHref(row), label: "🏷️ 建委託" }
      : side === "unknown"
        ? null
        : { href: buyerIntakeHref(row), label: "🏠 建買方" };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: CIS.radiusSm,
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        flexWrap: "wrap",
      }}
    >
      <Chip tone={tone}>{reason}</Chip>
      <span style={{ fontSize: FS(13), fontWeight: 700 }}>{row.name}</span>
      <span style={{ fontSize: FS(11) }} title={SIDE_META[side].label}>
        {SIDE_META[side].emoji}
      </span>
      <span style={{ fontSize: FS(11), color: CIS.textMute }}>
        {row.case_no ? `${row.case_no}・` : ""}
        {CONTACT_LABELS[row.contact_status || "uncontacted"]}
      </span>
      <span style={{ flex: 1 }} />
      {row.phone && <LinkPill href={`tel:${row.phone.replace(/[^0-9+]/g, "")}`} tone="primary">📞</LinkPill>}
      {intake && <LinkPill href={intake.href}>{intake.label}</LinkPill>}
      <LinkPill href={`/admin/appointments?q=${encodeURIComponent(row.case_no || row.name)}`}>開啟</LinkPill>
    </div>
  );
}

/** 歸檔區的一欄：同一邊（買 or 賣）的客戶擺在一起，按鈕就一顆，不用再想要按哪個 */
function SideColumn({
  title,
  why,
  rows,
  kind,
  empty,
}: {
  title: string;
  why: string;
  rows: AppointmentRow[];
  kind: "buyer" | "seller" | "unknown";
  empty: string;
}) {
  if (!rows.length && !empty) return null;

  return (
    <div
      style={{
        background: CIS.panel,
        border: `1px solid ${CIS.panelBorder}`,
        borderRadius: CIS.radiusSm,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: FS(13), fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: FS(13), fontWeight: 800, color: CIS.blueSoft, fontVariantNumeric: "tabular-nums" }}>
          {rows.length}
        </span>
        <span style={{ fontSize: FS(11), color: CIS.textMute }}>{why}</span>
      </div>

      {rows.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {rows.map((row) => (
            <div
              key={`${kind}-${row.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "9px 12px",
                background: CIS.card,
                border: `1px solid ${CIS.cardBorder}`,
                borderRadius: CIS.radiusSm,
              }}
            >
              <span style={{ fontSize: FS(12), fontWeight: 700, color: CIS.textMute, fontVariantNumeric: "tabular-nums" }}>
                {twTime(new Date(row.slot_at))}
              </span>
              <span style={{ fontSize: FS(13), fontWeight: 700 }}>{row.name}</span>
              <span style={{ fontSize: FS(11), color: CIS.textMute }}>
                {meetTypeEmoji(row.meet_type)} {meetTypeLabel(row.meet_type)}
                {IN_PERSON_MEET_TYPES.has(row.meet_type) ? "・實體拜訪" : ""}
              </span>
              {(!row.outcome_status || row.outcome_status === "none") && <Chip tone="warn">還沒填結果</Chip>}
              <span style={{ flex: 1 }} />
              {kind === "buyer" && <LinkPill href={buyerIntakeHref(row)} tone="primary">🏠 建進買方資料庫</LinkPill>}
              {kind === "seller" && <LinkPill href={sellerIntakeHref(row)} tone="primary">🏷️ 建成委託物件</LinkPill>}
              {kind === "unknown" && (
                <>
                  <LinkPill href={buyerIntakeHref(row)}>🏠 當買方建</LinkPill>
                  <LinkPill href={sellerIntakeHref(row)}>🏷️ 當賣方建</LinkPill>
                </>
              )}
              <LinkPill href={kind === "seller" ? sellerLookupHref(row) : buyerLookupHref(row)}>
                🔎 查建過沒
              </LinkPill>
              <LinkPill href={`/admin/appointments?q=${encodeURIComponent(row.case_no || row.name)}`}>填結果</LinkPill>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: FS(11), color: CIS.textMute }}>{empty}</div>
      )}
    </div>
  );
}

function SectionCard({
  id,
  title,
  subtitle,
  count,
  children,
}: {
  id?: string;
  title: string;
  subtitle: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ fontSize: FS(17), fontWeight: 800, margin: 0 }}>{title}</h2>
        {count !== undefined && (
          <span style={{ fontSize: FS(13), fontWeight: 800, color: CIS.blueSoft, fontVariantNumeric: "tabular-nums" }}>
            {count}
          </span>
        )}
        <span style={{ fontSize: FS(12), color: CIS.textMute }}>{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: FS(12),
        color: CIS.textMute,
        padding: "16px 14px",
        background: CIS.panel,
        border: `1px dashed ${CIS.panelBorder}`,
        borderRadius: CIS.radiusSm,
      }}
    >
      {children}
    </div>
  );
}

export default async function TodayWorkboardPage() {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="每日工作台" callbackUrl="/admin/today" />;
  }

  const now = new Date();
  const dateKey = taipeiDateKey(now);
  const weekday = taipeiWeekday(now);

  // 一次撈完再在記憶體裡分類：同一批資料要切成五個佇列，
  // 每個佇列各查一次資料庫是白花的（預約管理頁也是這個做法）。
  const [rows, dormant, reportDue] = await Promise.all([
    listAppointments({ limit: 500 }).catch(() => [] as AppointmentRow[]),
    // 買方／賣方資料庫都是後來才加的，沒建表的環境不該讓整頁掛掉
    listDormantBuyers(6).catch(() => [] as BuyerListItem[]),
    listReportDueSellers(12).catch(() => [] as SellerRow[]),
  ]);

  const alive = rows.filter((r) => !["cancelled", "expired"].includes(r.status));

  const todayRows = alive
    .filter((r) => isSameTaipeiDay(new Date(r.slot_at), now))
    .sort((a, b) => new Date(a.slot_at).getTime() - new Date(b.slot_at).getTime());

  const visitRows = todayRows.filter((r) => IN_PERSON_MEET_TYPES.has(r.meet_type));

  const uncontacted = alive.filter(
    (r) =>
      (r.contact_status || "uncontacted") === "uncontacted" &&
      new Date(r.created_at).getTime() < now.getTime() - 2 * 60 * 60_000,
  );

  const followupDue = alive.filter(
    (r) =>
      r.next_followup_at &&
      new Date(r.next_followup_at).getTime() <= now.getTime() &&
      r.contact_status !== "closed",
  );

  const pendingConfirm = alive.filter((r) => r.status === "pending_confirmation");

  const outcomePending = alive.filter(
    (r) =>
      new Date(r.slot_at).getTime() < now.getTime() &&
      ["confirmed", "completed"].includes(r.status) &&
      (!r.outcome_status || r.outcome_status === "none"),
  );

  // 今天已經見完面的（含實體拜訪）——這批人現在最需要的動作是「歸檔」，
  // 而不是再看一次行程。依買方線／賣方線拆開，因為兩邊要去的地方不同。
  const finishedToday = todayRows.filter((r) => new Date(r.slot_at).getTime() < now.getTime());
  const buyerSide = finishedToday.filter((r) => ["buyer", "both"].includes(caseSideOf(r)));
  const sellerSide = finishedToday.filter((r) => ["seller", "both"].includes(caseSideOf(r)));
  const unknownSide = finishedToday.filter((r) => caseSideOf(r) === "unknown");

  // 同一筆預約可能同時「沒聯絡」又「沒填結果」。四個佇列直接串起來的話，
  // 同一個人會在清單裡出現三四次，看起來事情比實際多——一人只留最急的那個理由。
  const REASON_ORDER: Array<{ rows: AppointmentRow[]; reason: string; tone: ChipTone }> = [
    { rows: uncontacted, reason: "超過 2 小時還沒打第一通", tone: "danger" },
    { rows: followupDue, reason: "跟進時間到了", tone: "warn" },
    { rows: pendingConfirm, reason: "客戶還沒確認出席", tone: "warn" },
    { rows: outcomePending, reason: "見過面了，結果還沒填", tone: "info" },
  ];
  const mustDo: Array<{ row: AppointmentRow; reason: string; tone: ChipTone }> = [];
  const seen = new Set<string>();
  for (const group of REASON_ORDER) {
    for (const row of group.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      mustDo.push({ row, reason: group.reason, tone: group.tone });
    }
  }

  const tasks = tasksForWeekday(weekday);
  const upcoming = todayRows.filter((r) => new Date(r.slot_at).getTime() >= now.getTime());
  const nextOne = upcoming[0];

  const stats: Array<{ label: string; value: number; tone: ChipTone; href: string }> = [
    { label: "今日行程", value: todayRows.length, tone: "info", href: "#today-appointments" },
    { label: "要出門的", value: visitRows.length, tone: "info", href: "#today-visits" },
    { label: "還沒聯絡", value: uncontacted.length, tone: uncontacted.length ? "danger" : "neutral", href: "#must-do" },
    { label: "跟進到期", value: followupDue.length, tone: followupDue.length ? "warn" : "neutral", href: "#must-do" },
    { label: "待填結果", value: outcomePending.length, tone: outcomePending.length ? "warn" : "neutral", href: "#must-do" },
    { label: "談完待歸檔", value: finishedToday.length, tone: finishedToday.length ? "warn" : "neutral", href: "#route-side" },
    { label: "該回報屋主", value: reportDue.length, tone: reportDue.length ? "danger" : "neutral", href: "#report-due" },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: CIS.bg,
        color: CIS.text,
        fontFamily: CIS.font,
        padding: "24px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 18 }}>
        {/* 頁首 */}
        <header
          style={{
            background: CIS.card,
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: 20,
          }}
        >
          <div style={{ ...cisGundamBar, marginBottom: 14 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: FS(24), fontWeight: 900, margin: 0 }}>今天要做什麼</h1>
            <span style={{ fontSize: FS(14), fontWeight: 700, color: CIS.blueSoft, fontVariantNumeric: "tabular-nums" }}>
              {twDateLabel(now)}
            </span>
            <span style={{ fontSize: FS(12), color: CIS.textMute }}>{OWNER.alias}的每日工作台</span>
          </div>

          <div style={{ fontSize: FS(13), color: CIS.textSub, marginTop: 8 }}>
            {nextOne ? (
              <>
                下一場：<b>{twTime(new Date(nextOne.slot_at))}</b> 見 <b>{nextOne.name}</b>
                （{meetTypeLabel(nextOne.meet_type)}）—— 記得提前 15 分鐘到。
              </>
            ) : todayRows.length ? (
              "今天的約都跑完了。剩下的時間拿去開發，別讓明天空著。"
            ) : (
              "今天沒有約。沒有約的日子最危險——下面那張清單，才是決定下個月有沒有案子的東西。"
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {stats.map((s) => (
              <a
                key={s.label}
                href={s.href}
                style={{
                  textDecoration: "none",
                  padding: "8px 14px",
                  borderRadius: CIS.radiusSm,
                  background: CHIP[s.tone].bg,
                  border: `1px solid ${CHIP[s.tone].border}`,
                  minWidth: 92,
                }}
              >
                <div style={{ fontSize: FS(20), fontWeight: 900, color: CHIP[s.tone].color, fontVariantNumeric: "tabular-nums" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: FS(11), fontWeight: 700, color: CHIP[s.tone].color }}>{s.label}</div>
              </a>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <LinkPill href="/admin/appointments">預約管理</LinkPill>
            <LinkPill href="/admin/buyers">買方資料庫</LinkPill>
            <LinkPill href="/admin/sellers">賣方資料庫</LinkPill>
            <LinkPill href="/admin/listings">物件管理</LinkPill>
            <LinkPill href="/admin/communities">社區主檔</LinkPill>
            <LinkPill href="/card/booking">預約頁（發給客戶）</LinkPill>
          </div>
        </header>

        {/* ① 今日行程 */}
        <SectionCard
          id="today-appointments"
          title="🗓️ 今日行程"
          count={todayRows.length}
          subtitle="每一場都附好連結：撥號、導航、改約連結、填結果"
        >
          {todayRows.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {todayRows.map((row) => (
                <AppointmentCard key={row.id} row={row} now={now} />
              ))}
            </div>
          ) : (
            <Empty>今天沒有預約。把預約頁發出去：{absoluteUrl("/card/booking")}</Empty>
          )}
        </SectionCard>

        {/* ② 實體拜訪路線 */}
        <SectionCard
          id="today-visits"
          title="🚗 今天要出門的"
          count={visitRows.length}
          subtitle="照時間排好順序，出門前先把整條路線看過一遍"
        >
          {visitRows.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {visitRows.map((row, i) => (
                <AppointmentCard key={row.id} row={row} now={now} order={i + 1} />
              ))}
              <div style={{ fontSize: FS(11), color: CIS.textMute, paddingLeft: 4 }}>
                💡 兩站之間如果有空檔，順路排一個實體拜訪（管理室、店家、老客戶）——
                今天出門見了幾個人，決定下個月有幾個案子。
              </div>
            </div>
          ) : (
            <Empty>
              今天沒有要出門的約。自己排三個點：社區管理室、商圈店家、上次成交的老客戶。
              面對面十分鐘勝過電話十通。
            </Empty>
          )}
        </SectionCard>

        {/* ③ 不做會漏掉的 */}
        <SectionCard
          id="must-do"
          title="🔥 今天不處理就會漏掉的"
          count={mustDo.length}
          subtitle="這幾件事拖過今天，客戶就冷了"
        >
          {mustDo.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: FS(11), color: CIS.textMute, marginBottom: 2 }}>
                每一列右邊的 🏠／🏷️ 就是這個人該歸到哪一邊；按下去直接帶著他的資料去建檔。
              </div>
              {mustDo.map((item) => (
                <TaskRow key={item.row.id} row={item.row} reason={item.reason} tone={item.tone} />
              ))}
            </div>
          ) : (
            <Empty>沒有逾期的事情。這代表你昨天做得很好——今天也維持住。</Empty>
          )}
        </SectionCard>

        {/* ④ 談完 / 拜訪完 → 分流歸檔 */}
        <SectionCard
          id="route-side"
          title="📥 談完了，歸到買方還是賣方"
          count={finishedToday.length}
          subtitle="見過面、拜訪完的，今天就要進系統——留在腦袋裡的客戶不會自己變成成交"
        >
          {finishedToday.length ? (
            <div style={{ display: "grid", gap: 14 }}>
              <SideColumn
                title="🏠 買方線 → 買方資料庫"
                why="建進去才配得到物件、才進得了群發名單"
                rows={buyerSide}
                kind="buyer"
                empty="今天沒有談到買方。"
              />
              <SideColumn
                title="🏷️ 賣方線 → 委託物件庫"
                why="建成物件才算得出「手上有幾個買方符合」"
                rows={sellerSide}
                kind="seller"
                empty="今天沒有談到賣方。"
              />
              {unknownSide.length > 0 && (
                <SideColumn
                  title="❓ 還沒分線"
                  why="意圖沒勾、備註也看不出來——先想清楚他是要買還是要賣"
                  rows={unknownSide}
                  kind="unknown"
                  empty=""
                />
              )}
            </div>
          ) : (
            <Empty>今天還沒有結束的約。每談完一場，這裡就會出現一張「該歸到哪」的卡。</Empty>
          )}
        </SectionCard>

        {/* ⑤ 該回報的屋主 */}
        <SectionCard
          id="report-due"
          title="📣 該回報屋主了"
          count={reportDue.length}
          subtitle={`委託中的屋主超過 ${REPORT_DUE_DAYS} 天沒回報就會出現在這裡`}
        >
          {reportDue.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: FS(11), color: CIS.textMute, marginBottom: 2 }}>
                屋主抱怨房仲的第一名不是賣不掉，是<b>不知道你在幹嘛</b>。
                點「做回報」會自動撈出這段期間帶看幾組、買方嫌什麼，組成可以直接貼 LINE 的內容。
              </div>
              {reportDue.map((s) => {
                const d = daysSinceReport(s);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      padding: "9px 12px",
                      background: CIS.card,
                      border: `1px solid ${CHIP.danger.border}`,
                      borderRadius: CIS.radiusSm,
                    }}
                  >
                    <Chip tone="danger">已 {d} 天沒回報</Chip>
                    <span style={{ fontSize: FS(13), fontWeight: 700 }}>{s.name}</span>
                    <span style={{ fontSize: FS(11), color: CIS.textMute }}>
                      {sellerStageLabel(s.stage)}・{motiveLabel(s.motive)}
                      {s.ask_price ? `・開價 ${s.ask_price} 萬` : ""}
                    </span>
                    <span style={{ flex: 1 }} />
                    {s.phone_norm && (
                      <LinkPill href={`tel:${s.phone_norm}`} tone="primary">
                        📞
                      </LinkPill>
                    )}
                    <LinkPill href={`/admin/sellers/${s.id}`}>📣 做回報</LinkPill>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>
              沒有逾期未回報的屋主。委託中的每個屋主，一週至少要主動講一次「這週做了什麼」——
              只說「還在努力」的回報，等於沒回報。
            </Empty>
          )}
        </SectionCard>

        {/* ⑥ 每日固定清單 */}
        <DailyChecklist dateKey={dateKey} blocks={DAILY_BLOCKS} tasks={tasks} />

        {/* ⑦ 沉睡買方 */}
        <SectionCard
          id="dormant"
          title="😴 好久沒聯絡的買方"
          count={dormant.length}
          subtitle="名單放著不會自己變成成交，今天挑兩個打"
        >
          {dormant.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {dormant.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: CIS.radiusSm,
                    background: CIS.card,
                    border: `1px solid ${CIS.cardBorder}`,
                    flexWrap: "wrap",
                  }}
                >
                  <Chip tone={b.grade === "A" ? "danger" : "neutral"}>{b.grade} 級</Chip>
                  <span style={{ fontSize: FS(13), fontWeight: 700 }}>{b.name}</span>
                  <span style={{ fontSize: FS(11), color: CIS.textMute }}>
                    {b.last_contact_at
                      ? `上次聯絡 ${Math.floor((now.getTime() - new Date(b.last_contact_at).getTime()) / 86400_000)} 天前`
                      : "從來沒聯絡過"}
                    {districtNames(b.districts) ? `・想找 ${districtNames(b.districts)}` : ""}
                  </span>
                  <span style={{ flex: 1 }} />
                  {b.phone_norm && <LinkPill href={`tel:${b.phone_norm}`} tone="primary">📞</LinkPill>}
                  <LinkPill href={`/admin/buyers/${b.id}`}>開啟</LinkPill>
                </div>
              ))}
            </div>
          ) : (
            <Empty>沒有沉睡名單，或買方資料庫還沒開始用。</Empty>
          )}
        </SectionCard>

        <div style={{ fontSize: FS(11), color: CIS.textMute, textAlign: "center", paddingTop: 4 }}>
          清單勾選存在這台電腦的瀏覽器裡，每天零點自動歸零 ·
          內容要改請動 <code>src/lib/daily-tasks.ts</code>
        </div>
      </div>
    </main>
  );
}
