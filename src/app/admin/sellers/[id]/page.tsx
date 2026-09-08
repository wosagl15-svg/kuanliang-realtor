/**
 * 屋主詳情 /admin/sellers/[id]（2026-08-22）
 *
 * 版面順序刻意是這樣：
 *   ① 他是誰、現在什麼狀態（含「幾天沒回報」的紅燈）
 *   ② 意圖判讀 —— 分數、每一分的理由、現在該做什麼、還缺哪幾題
 *   ③ 開價鬆動曲線
 *   ④ 他的物件
 *   ⑤ 屋主回報表
 *   ⑥ AI 深度判讀
 *   ⑦ 聯絡歷程（最長，放最後）
 *
 * 「該做什麼」在上面、「歷程」在下面，是因為打開這頁的當下多半是要打電話前的三十秒，
 * 那時候要的是結論，不是把三個月的紀錄再讀一遍。
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS, CHIP, FS, cisGundamBar, type ChipTone } from "@/app/admin/_components/cis";
import {
  getSeller,
  listSellerContacts,
  listSellerListings,
  listUnclaimedListings,
  computeIntent,
  daysSinceReport,
  isReportOverdue,
} from "@/lib/seller";
import {
  sellerStageLabel,
  motiveLabel,
  priceFlexLabel,
  sellerSourceLabel,
  REPORT_DUE_DAYS,
  RENEWAL_WARNING_DAYS,
} from "@/lib/seller-constants";
import { districtLabel } from "@/lib/buyer-constants";
import ContactPanel, { type ContactItem } from "./ContactPanel";
import ListingPanel from "./ListingPanel";
import ReportPanel from "./ReportPanel";
import AiPanel from "./AiPanel";
import EditPanel, { type EditableSeller } from "./EditPanel";

export const dynamic = "force-dynamic";

const INTENT_META: Record<string, { label: string; tone: ChipTone }> = {
  hot: { label: "🔥 真的要賣", tone: "danger" },
  warm: { label: "🙂 有機會", tone: "warn" },
  cold: { label: "👀 試水溫", tone: "neutral" },
  unknown: { label: "❓ 資料不夠", tone: "neutral" },
};

function twDate(d: Date | string | null): string {
  if (!d) return "";
  const x = new Date(new Date(d).getTime() + 8 * 60 * 60_000);
  return `${x.getUTCFullYear()}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${String(x.getUTCDate()).padStart(2, "0")}`;
}

/** <input type="date"> 只吃 YYYY-MM-DD */
function dateInput(d: Date | string | null): string {
  if (!d) return "";
  const x = new Date(new Date(d).getTime() + 8 * 60 * 60_000);
  return x.toISOString().slice(0, 10);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: FS(10.5), color: CIS.textMute, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: FS(13), lineHeight: 1.6 }}>{value || <span style={{ color: CIS.textMute }}>—</span>}</div>
    </div>
  );
}

export default async function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isCurrentUserAdmin())) {
    const { id } = await params;
    return <RequireLogin title="屋主詳情" callbackUrl={`/admin/sellers/${id}`} />;
  }

  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) notFound();

  const [logs, mine, unclaimed] = await Promise.all([
    listSellerContacts(id, 200),
    listSellerListings(id),
    listUnclaimedListings(50),
  ]);

  const intent = computeIntent(seller, logs);
  const meta = INTENT_META[intent.label] ?? INTENT_META.unknown;
  const overdue = isReportOverdue(seller);
  const sinceReport = daysSinceReport(seller);

  // 開價鬆動曲線：只有兩筆以上才畫得出趨勢
  const priceTrail = logs
    .filter((l) => typeof l.price_mentioned === "number" && (l.price_mentioned as number) > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    .map((l) => ({ at: new Date(l.occurred_at), price: l.price_mentioned as number }));

  const mandateDaysLeft = seller.mandate_end
    ? Math.ceil((new Date(seller.mandate_end).getTime() - Date.now()) / 86400_000)
    : null;

  const contactItems: ContactItem[] = logs.map((l) => ({
    id: l.id,
    type: l.type,
    content: l.content,
    sentiment: l.sentiment,
    price_mentioned: l.price_mentioned,
    occurred_at: new Date(l.occurred_at).toISOString(),
  }));

  const listingOptions = mine.map((l) => ({ id: l.id, title: l.title }));

  const editable: EditableSeller = {
    name: seller.name,
    phone: seller.phone_raw ?? seller.phone_norm ?? "",
    email: seller.email ?? "",
    line: seller.line_user_id ?? "",
    stage: seller.stage,
    motive: seller.motive,
    motiveNote: seller.motive_note ?? "",
    priceFlex: seller.price_flex,
    askPrice: seller.ask_price != null ? String(seller.ask_price) : "",
    bottomPrice: seller.bottom_price != null ? String(seller.bottom_price) : "",
    decisionMaker: seller.decision_maker ?? "",
    coOwnerNote: seller.co_owner_note ?? "",
    deadlineAt: dateInput(seller.deadline_at),
    mandateStart: dateInput(seller.mandate_start),
    mandateEnd: dateInput(seller.mandate_end),
    mandateKind: seller.mandate_kind ?? "",
    personalityNote: seller.personality_note ?? "",
  };

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
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link href="/admin/sellers" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
            ← 賣方資料庫
          </Link>
          <Link href="/admin/today" style={{ fontSize: FS(13), color: CIS.textMute, textDecoration: "none" }}>
            每日工作台
          </Link>
        </div>

        {/* ① 頭 */}
        <section
          style={{
            background: CIS.card,
            border: `1px solid ${overdue ? CHIP.danger.border : CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: 20,
          }}
        >
          <div style={{ ...cisGundamBar, marginBottom: 14, maxWidth: 240 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: FS(24), fontWeight: 900, margin: 0 }}>{seller.name}</h1>
            <span
              style={{
                fontSize: FS(11),
                fontWeight: 800,
                padding: "3px 11px",
                borderRadius: 999,
                background: CHIP[meta.tone].bg,
                color: CHIP[meta.tone].color,
                border: `1px solid ${CHIP[meta.tone].border}`,
              }}
            >
              {meta.label}　{intent.score} 分
            </span>
            <span style={{ fontSize: FS(12), color: CIS.textSub }}>{sellerStageLabel(seller.stage)}</span>
            {overdue && (
              <span
                style={{
                  fontSize: FS(11.5),
                  fontWeight: 800,
                  padding: "3px 11px",
                  borderRadius: 999,
                  background: CHIP.danger.bg,
                  color: CHIP.danger.color,
                  border: `1px solid ${CHIP.danger.border}`,
                }}
              >
                🔴 已 {sinceReport} 天沒回報（超過 {REPORT_DUE_DAYS} 天）
              </span>
            )}
            {mandateDaysLeft !== null && mandateDaysLeft <= RENEWAL_WARNING_DAYS && mandateDaysLeft > -30 && (
              <span
                style={{
                  fontSize: FS(11.5),
                  fontWeight: 800,
                  padding: "3px 11px",
                  borderRadius: 999,
                  background: CHIP.warn.bg,
                  color: CHIP.warn.color,
                  border: `1px solid ${CHIP.warn.border}`,
                }}
              >
                ⏳ 委託{mandateDaysLeft >= 0 ? `剩 ${mandateDaysLeft} 天` : `已過期 ${-mandateDaysLeft} 天`}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
            {seller.phone_raw && (
              <a
                href={`tel:${seller.phone_norm}`}
                style={{
                  fontSize: FS(12),
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 999,
                  textDecoration: "none",
                  background: CIS.blue,
                  color: CIS.onAccent,
                }}
              >
                📞 {seller.phone_raw}
              </a>
            )}
            {seller.email && (
              <a
                href={`mailto:${seller.email}`}
                style={{
                  fontSize: FS(12),
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 999,
                  textDecoration: "none",
                  border: `1px solid ${CIS.cardBorder}`,
                  color: CIS.textSub,
                }}
              >
                ✉️ {seller.email}
              </a>
            )}
            {seller.appointment_id && (
              <a
                href={`/admin/appointments?q=${encodeURIComponent(seller.name)}`}
                style={{
                  fontSize: FS(12),
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 999,
                  textDecoration: "none",
                  border: `1px solid ${CIS.cardBorder}`,
                  color: CIS.textSub,
                }}
              >
                🗓️ 來源預約
              </a>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
            <Field label="賣的動機" value={motiveLabel(seller.motive)} />
            <Field label="價格態度" value={priceFlexLabel(seller.price_flex)} />
            <Field label="目前開價" value={seller.ask_price ? `${seller.ask_price} 萬` : ""} />
            <Field label="他透露的底價" value={seller.bottom_price ? `${seller.bottom_price} 萬` : ""} />
            <Field label="誰能點頭" value={seller.decision_maker} />
            <Field label="共有人" value={seller.co_owner_note} />
            <Field label="他說的期限" value={twDate(seller.deadline_at)} />
            <Field
              label="委託期間"
              value={
                seller.mandate_start || seller.mandate_end
                  ? `${twDate(seller.mandate_start)} ~ ${twDate(seller.mandate_end)}`
                  : ""
              }
            />
            <Field label="從哪來的" value={sellerSourceLabel(seller.source)} />
            <Field label="上次聯絡" value={twDate(seller.last_contact_at)} />
            <Field label="上次回報" value={seller.last_report_at ? twDate(seller.last_report_at) : "還沒回報過"} />
          </div>

          {(seller.motive_note || seller.personality_note) && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 13px",
                background: CIS.panel,
                border: `1px solid ${CIS.panelBorder}`,
                borderRadius: CIS.radiusSm,
                fontSize: FS(12.5),
                lineHeight: 1.8,
              }}
            >
              {seller.motive_note && <div>💬 他說：{seller.motive_note}</div>}
              {seller.personality_note && <div>🧠 個性：{seller.personality_note}</div>}
            </div>
          )}

          {/* 上面整片是唯讀的（打電話前三十秒要看結論，不是一堆輸入框）；要改按這顆 */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${CIS.panelBorder}` }}>
            <EditPanel sellerId={id} initial={editable} />
          </div>
        </section>

        {/* ② 意圖判讀 */}
        <section
          style={{
            background: CIS.card,
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: 18,
          }}
        >
          <h2 style={{ fontSize: FS(16), fontWeight: 800, margin: "0 0 4px" }}>🎯 他到底要不要賣</h2>
          <div style={{ fontSize: FS(14), fontWeight: 700, color: CHIP[meta.tone].color, marginBottom: 12 }}>
            {intent.headline}
          </div>

          <div style={{ display: "grid", gap: 5, marginBottom: 14 }}>
            {intent.factors.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "8px 12px",
                  background: CIS.panel,
                  border: `1px solid ${CIS.panelBorder}`,
                  borderRadius: CIS.radiusSm,
                }}
              >
                <span
                  style={{
                    fontSize: FS(12),
                    fontWeight: 900,
                    minWidth: 34,
                    textAlign: "right",
                    color: f.points > 0 ? "#0f7a45" : f.points < 0 ? CHIP.danger.color : CIS.textMute,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {f.points > 0 ? "+" : ""}
                  {f.points}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: FS(12.5), fontWeight: 700 }}>{f.label}</div>
                  <div style={{ fontSize: FS(11.5), color: CIS.textMute, lineHeight: 1.6 }}>{f.why}</div>
                </div>
              </div>
            ))}
          </div>

          {intent.nextActions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: FS(11), fontWeight: 800, color: CIS.textMute, marginBottom: 6 }}>現在該做什麼</div>
              <div style={{ display: "grid", gap: 5 }}>
                {intent.nextActions.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: FS(12.5),
                      lineHeight: 1.7,
                      padding: "8px 12px",
                      background: CHIP.info.bg,
                      border: `1px solid ${CHIP.info.border}`,
                      borderRadius: CIS.radiusSm,
                      color: CHIP.info.color,
                    }}
                  >
                    → {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          {intent.missing.length > 0 && (
            <div
              style={{
                fontSize: FS(12),
                lineHeight: 1.8,
                padding: "10px 13px",
                background: CHIP.warn.bg,
                border: `1px solid ${CHIP.warn.border}`,
                borderRadius: CIS.radiusSm,
                color: CHIP.warn.color,
              }}
            >
              <b>還沒問出來的（下次見面補問）：</b>
              {intent.missing.join("、")}
              <br />
              <span style={{ fontWeight: 400 }}>
                這幾題沒有答案，分數就只是半個結論 —— 系統不會拿猜的來湊。
              </span>
            </div>
          )}
        </section>

        {/* ③ 開價鬆動曲線 */}
        {priceTrail.length >= 2 && (
          <section
            style={{
              background: CIS.card,
              border: `1px solid ${CIS.cardBorder}`,
              borderRadius: CIS.radius,
              padding: 18,
            }}
          >
            <h2 style={{ fontSize: FS(16), fontWeight: 800, margin: "0 0 4px" }}>📉 開價鬆動曲線</h2>
            <p style={{ fontSize: FS(11.5), color: CIS.textMute, margin: "0 0 12px", lineHeight: 1.7 }}>
              他實際降過幾次、降多少。<b>這比他嘴上說一百句「可以談」都準。</b>
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {priceTrail.map((p, i) => {
                const prev = i > 0 ? priceTrail[i - 1].price : null;
                const down = prev !== null && p.price < prev;
                const up = prev !== null && p.price > prev;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {i > 0 && <span style={{ color: CIS.textMute, fontSize: FS(12) }}>→</span>}
                    <div
                      style={{
                        padding: "7px 13px",
                        borderRadius: CIS.radiusSm,
                        background: down ? CHIP.success.bg : up ? CHIP.danger.bg : CIS.panel,
                        border: `1px solid ${down ? CHIP.success.border : up ? CHIP.danger.border : CIS.panelBorder}`,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: FS(14),
                          fontWeight: 900,
                          fontVariantNumeric: "tabular-nums",
                          color: down ? CHIP.success.color : up ? CHIP.danger.color : CIS.text,
                        }}
                      >
                        {p.price}
                      </div>
                      <div style={{ fontSize: FS(10), color: CIS.textMute }}>{twDate(p.at).slice(5)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const first = priceTrail[0].price;
              const last = priceTrail[priceTrail.length - 1].price;
              const pct = ((first - last) / first) * 100;
              return (
                <div style={{ fontSize: FS(12), color: CIS.textSub, marginTop: 12, lineHeight: 1.7 }}>
                  {pct > 0
                    ? `總共降了 ${first - last} 萬（${pct.toFixed(1)}%）。會降第一次就會有第二次 —— 下一次帶看回饋是最好的施力點。`
                    : pct < 0
                      ? `不降反升 ${last - first} 萬。屋主的預期在往上跑，多半是聽到鄰居賣多少；先把實際成交行情攤給他看。`
                      : "開價沒動過。"}
                </div>
              );
            })()}
          </section>
        )}

        {/* ④ 物件 */}
        <ListingPanel
          sellerId={id}
          mine={mine.map((l) => ({
            id: l.id,
            title: l.title,
            district: districtLabel(l.district),
            price: l.price,
            status: l.status,
          }))}
          unclaimed={unclaimed.map((l) => ({
            id: l.id,
            title: l.title,
            district: districtLabel(l.district),
            price: l.price,
            status: l.status,
          }))}
        />

        {/* ⑤ 屋主回報表 */}
        <ReportPanel
          sellerId={id}
          listings={listingOptions}
          lastReportAt={seller.last_report_at ? twDate(seller.last_report_at) : null}
        />

        {/* ⑥ AI 判讀 */}
        <AiPanel sellerId={id} logCount={logs.length} />

        {/* ⑦ 聯絡歷程 */}
        <ContactPanel sellerId={id} items={contactItems} listings={listingOptions} />
      </div>
    </main>
  );
}
