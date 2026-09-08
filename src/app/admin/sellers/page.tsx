/**
 * 賣方（屋主）名單 /admin/sellers（2026-08-22）
 *
 * 排序邏輯刻意不是「最近建的在最上面」，而是：
 *   議價中 → 委託中 → 還沒簽 ，同組內再按「意圖分數高、最久沒回報」往前排。
 * 因為這頁要回答的是「今天先處理誰」，不是「我建了哪些人」。
 */
import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS, CHIP, FS, cisGundamBar } from "@/app/admin/_components/cis";
import { listSellers, sellerStats, daysSinceReport, isReportOverdue } from "@/lib/seller";
import {
  SELLER_STAGES,
  sellerStageLabel,
  motiveLabel,
  priceFlexLabel,
  REPORT_DUE_DAYS,
} from "@/lib/seller-constants";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; stage?: string; intent?: string; due?: string };

const INTENT_META: Record<string, { label: string; tone: keyof typeof CHIP }> = {
  hot: { label: "🔥 真的要賣", tone: "danger" },
  warm: { label: "🙂 有機會", tone: "warn" },
  cold: { label: "👀 試水溫", tone: "neutral" },
  unknown: { label: "❓ 資料不夠", tone: "neutral" },
};

const INTENT_FILTERS = [
  { key: "all", label: "全部" },
  { key: "hot", label: "🔥 真的要賣" },
  { key: "warm", label: "🙂 有機會" },
  { key: "cold", label: "👀 試水溫" },
  { key: "unknown", label: "❓ 資料不夠" },
];

function href(sp: SearchParams, next: Partial<SearchParams>): string {
  const p = new URLSearchParams();
  const m = { ...sp, ...next };
  if (m.q) p.set("q", m.q);
  if (m.stage && m.stage !== "all") p.set("stage", m.stage);
  if (m.intent && m.intent !== "all") p.set("intent", m.intent);
  if (m.due === "1") p.set("due", "1");
  const s = p.toString();
  return `/admin/sellers${s ? `?${s}` : ""}`;
}

export default async function SellersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="賣方資料庫" callbackUrl="/admin/sellers" />;
  }

  const sp = await searchParams;
  const [{ rows, total }, stats] = await Promise.all([
    listSellers({
      q: sp.q,
      stage: sp.stage,
      intent: sp.intent,
      reportDue: sp.due === "1",
    }),
    sellerStats(),
  ]);

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
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
          <Link href="/admin/today" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
            ← 每日工作台
          </Link>
          <Link href="/admin/buyers" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
            買方資料庫
          </Link>
          <Link href="/admin/listings" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
            物件庫
          </Link>
        </div>

        <div style={{ ...cisGundamBar, marginBottom: 14, maxWidth: 320 }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: FS(24), fontWeight: 900, margin: 0 }}>賣方資料庫</h1>
          <Link
            href="/admin/sellers/new"
            style={{
              fontSize: FS(12),
              fontWeight: 800,
              padding: "6px 14px",
              borderRadius: 999,
              background: CIS.blue,
              color: CIS.onAccent,
              textDecoration: "none",
            }}
          >
            ＋ 新增屋主
          </Link>
        </div>
        <p style={{ fontSize: FS(13), color: CIS.textSub, margin: "8px 0 18px", lineHeight: 1.7 }}>
          每次聯絡記一句話，系統會算出「他到底真的要賣，還是掛著試水溫」，
          並在該回報屋主的時候把他推到最上面。
          <br />
          <span style={{ color: CIS.textMute }}>
            委託中的屋主超過 {REPORT_DUE_DAYS} 天沒回報就會亮紅燈 ——
            屋主抱怨房仲的第一名不是賣不掉，是不知道你在幹嘛。
          </span>
        </p>

        {/* 統計 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { label: "全部屋主", value: stats.total, tone: "info" as const, to: href(sp, { stage: "all", due: "" }) },
            { label: "委託銷售中", value: stats.listed, tone: "success" as const, to: href(sp, { stage: "listed", due: "" }) },
            { label: "議價中", value: stats.negotiating, tone: "warn" as const, to: href(sp, { stage: "negotiating", due: "" }) },
            {
              label: `${REPORT_DUE_DAYS} 天沒回報`,
              value: stats.reportDue,
              tone: stats.reportDue ? ("danger" as const) : ("neutral" as const),
              to: href(sp, { due: "1", stage: "all" }),
            },
          ].map((s) => (
            <Link
              key={s.label}
              href={s.to}
              style={{
                textDecoration: "none",
                padding: "9px 16px",
                borderRadius: CIS.radiusSm,
                background: CHIP[s.tone].bg,
                border: `1px solid ${CHIP[s.tone].border}`,
                minWidth: 104,
              }}
            >
              <div style={{ fontSize: FS(20), fontWeight: 900, color: CHIP[s.tone].color, fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </div>
              <div style={{ fontSize: FS(11), fontWeight: 700, color: CHIP[s.tone].color }}>{s.label}</div>
            </Link>
          ))}
        </div>

        {/* 篩選 */}
        <form
          method="get"
          style={{
            background: CIS.card,
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: 14,
            marginBottom: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="搜尋姓名或電話"
            style={{
              padding: "8px 12px",
              background: CIS.panel,
              border: `1px solid ${CIS.cardBorder}`,
              borderRadius: CIS.radiusSm,
              fontSize: FS(13),
              fontFamily: CIS.font,
              color: CIS.text,
              minWidth: 200,
            }}
          />
          <select
            name="stage"
            defaultValue={sp.stage ?? "all"}
            style={{
              padding: "8px 12px",
              background: CIS.panel,
              border: `1px solid ${CIS.cardBorder}`,
              borderRadius: CIS.radiusSm,
              fontSize: FS(13),
              fontFamily: CIS.font,
              color: CIS.text,
            }}
          >
            <option value="all">全部階段</option>
            {SELLER_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            name="intent"
            defaultValue={sp.intent ?? "all"}
            style={{
              padding: "8px 12px",
              background: CIS.panel,
              border: `1px solid ${CIS.cardBorder}`,
              borderRadius: CIS.radiusSm,
              fontSize: FS(13),
              fontFamily: CIS.font,
              color: CIS.text,
            }}
          >
            {INTENT_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FS(12), color: CIS.textSub }}>
            <input type="checkbox" name="due" value="1" defaultChecked={sp.due === "1"} />
            只看該回報的
          </label>
          <button
            type="submit"
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              background: CIS.blue,
              color: CIS.onAccent,
              fontSize: FS(12),
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: CIS.font,
            }}
          >
            篩選
          </button>
        </form>

        <div style={{ fontSize: FS(12), color: CIS.textMute, marginBottom: 10 }}>
          共 {total} 位{rows.length < total ? `（顯示前 ${rows.length} 位）` : ""}
        </div>

        {rows.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((s) => {
              const overdue = isReportOverdue(s);
              const days = daysSinceReport(s);
              const intent = INTENT_META[s.intent_label] ?? INTENT_META.unknown;
              return (
                <Link
                  key={s.id}
                  href={`/admin/sellers/${s.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "13px 16px",
                    background: CIS.card,
                    border: `1px solid ${overdue ? CHIP.danger.border : CIS.cardBorder}`,
                    borderRadius: CIS.radius,
                  }}
                >
                  <span
                    style={{
                      fontSize: FS(10),
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: CHIP[intent.tone].bg,
                      color: CHIP[intent.tone].color,
                      border: `1px solid ${CHIP[intent.tone].border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {intent.label} {s.intent_score}
                  </span>
                  <span style={{ fontSize: FS(15), fontWeight: 800 }}>{s.name}</span>
                  <span style={{ fontSize: FS(11), color: CIS.textMute }}>
                    {sellerStageLabel(s.stage)}・{motiveLabel(s.motive)}・{priceFlexLabel(s.price_flex)}
                    {s.ask_price ? `・開價 ${s.ask_price} 萬` : ""}
                  </span>
                  <span style={{ flex: 1 }} />
                  {overdue ? (
                    <span
                      style={{
                        fontSize: FS(11),
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: 999,
                        background: CHIP.danger.bg,
                        color: CHIP.danger.color,
                        border: `1px solid ${CHIP.danger.border}`,
                      }}
                    >
                      已 {days} 天沒回報
                    </span>
                  ) : (
                    <span style={{ fontSize: FS(11), color: CIS.textMute }}>
                      {days === null ? "" : days === 0 ? "今天回報過" : `${days} 天前回報`}
                    </span>
                  )}
                  <span style={{ fontSize: FS(12), color: CIS.blueSoft, fontWeight: 700 }}>開啟 →</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              fontSize: FS(13),
              color: CIS.textMute,
              padding: "26px 18px",
              background: CIS.panel,
              border: `1px dashed ${CIS.panelBorder}`,
              borderRadius: CIS.radius,
              lineHeight: 1.8,
            }}
          >
            還沒有屋主資料。
            <br />
            兩條路進來：① 上面的「＋ 新增屋主」　② 每日工作台談完賣方線的約，按「建進賣方資料庫」會自動帶資料過來。
          </div>
        )}
      </div>
    </main>
  );
}
