import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import { CIS, CHIP, type ChipTone } from "@/app/admin/_components/cis";
import { listBuyers, buyerStats, type BuyerListItem, parseJsonArray } from "@/lib/buyer";
import { listingStats } from "@/lib/listing";
import { computeCompleteness } from "@/lib/buyer-completeness";
import {
  CORE_DISTRICTS,
  DISTRICTS,
  GRADE_TONE,
  STAGES,
  DORMANT_DAYS,
  districtLabel,
  stageLabel,
} from "@/lib/buyer-constants";
import { formatPhone } from "@/lib/phone";
import SeedDemoButton from "./SeedDemoButton";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  district?: string;
  grade?: string;
  stage?: string;
  order?: string;
  dormant?: string;
};

/** 用列表已撈到的欄位重算完整度，才能顯示「缺哪三個」—— 分數是報告，缺什麼才是行動 */
function missingOf(r: BuyerListItem): string[] {
  return computeCompleteness({
    name: r.name,
    phone_norm: r.phone_norm,
    budget_max: r.budget_max,
    districts: parseJsonArray(r.districts),
    room_min: r.room_min,
    parking: r.parking,
    elevator: r.elevator,
    purpose: r.purpose,
    size_min: r.size_min,
    age_max: r.age_max,
    tags: Number(r.tag_count) > 0 ? ["有標籤"] : [],
    decision_maker: r.decision_maker,
    urgency: r.urgency,
    funding_note: r.funding_note,
  }).topMissing;
}

function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const c = CHIP[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div
      style={{
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: "14px 16px",
        minWidth: 130,
        flex: "1 1 130px",
      }}
    >
      <div style={{ fontSize: 11, color: CIS.textMute, marginBottom: 6, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone ?? CIS.text, lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: CIS.textMute, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

export default async function BuyersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await isCurrentUserAdmin())) {
    return (
      <main style={{ minHeight: "100vh", background: CIS.bg, color: CIS.text, padding: 40, fontFamily: CIS.font }}>
        <p>需要登入才能使用買方資料庫。</p>
      </main>
    );
  }

  const sp = await searchParams;
  const districts = sp.district ? [sp.district] : undefined;

  const [{ rows, total }, stats, lstats] = await Promise.all([
    listBuyers({
      q: sp.q,
      districts,
      grades: sp.grade ? [sp.grade] : undefined,
      stages: sp.stage ? [sp.stage] : undefined,
      dormantOverDays: sp.dormant === "1" ? DORMANT_DAYS : undefined,
      orderBy: (sp.order as "heat" | "completeness" | "recent" | "created") ?? "heat",
      limit: 200,
    }),
    buyerStats(),
    listingStats(),
  ]);

  const empty = stats.total === 0;

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
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        {/* 標題列 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>買方名單</h1>
            <p style={{ fontSize: 13, color: CIS.textSub, margin: 0 }}>
              篩選出同需求的一批人 → 串聯推播 → 知道誰點了
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { href: "/admin/listings", label: "物件庫" },
              { href: "/admin/communities", label: "社區主檔" },
            ].map((x) => (
              <Link
                key={x.href}
                href={x.href}
                style={{
                  padding: "9px 16px",
                  borderRadius: CIS.radiusSm,
                  border: `1px solid ${CIS.cardBorder}`,
                  color: CIS.textSub,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                {x.label}
              </Link>
            ))}
            <Link
              href="/admin/buyers/new"
              style={{
                padding: "9px 18px",
                borderRadius: CIS.radiusSm,
                background: CIS.blue,
                color: "#1a1200",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              + 貼對話建檔
            </Link>
          </div>
        </div>

        {/* 統計 */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <StatCard label="買方總數" value={stats.total} />
          <StatCard label="A 級（資料齊）" value={stats.byGrade.A ?? 0} tone={CHIP.success.color} />
          <StatCard
            label="待補資料"
            value={stats.needData}
            hint="完整度未達 50%"
            tone={stats.needData > 0 ? CHIP.warn.color : undefined}
          />
          <StatCard
            label="沉睡名單"
            value={stats.dormant}
            hint={`超過 ${DORMANT_DAYS} 天沒接觸`}
            tone={stats.dormant > 0 ? CHIP.danger.color : undefined}
          />
          <StatCard label="在售物件" value={lstats.onsale} hint={lstats.demo > 0 ? `含 ${lstats.demo} 筆示範` : undefined} />
        </div>

        {/* 空狀態 */}
        {empty && (
          <section
            style={{
              background: "rgba(200,150,62,0.07)",
              border: `1px solid ${CIS.blue}44`,
              borderRadius: CIS.radius,
              padding: 24,
              marginBottom: 18,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>還沒有任何買方資料</h2>
            <p style={{ fontSize: 13.5, color: CIS.textSub, lineHeight: 1.8, margin: "0 0 16px" }}>
              兩條路：
              <br />
              1. 先塞一批海線示範社區與物件，把配案畫面跑起來看看順不順手（示範資料都有「示範·」前綴，隨時可以清掉）
              <br />
              2. 直接<Link href="/admin/buyers/new" style={{ color: CIS.blueSoft }}>貼一段真實的 LINE 對話</Link>建第一筆客戶
            </p>
            <SeedDemoButton />
          </section>
        )}

        {/* 篩選面板 */}
        <form
          method="GET"
          style={{
            background: CIS.card,
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radius,
            padding: 16,
            marginBottom: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "2 1 220px" }}>
            <label style={{ display: "block", fontSize: 11, color: CIS.textMute, marginBottom: 5 }}>
              姓名 / 電話
            </label>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="陳先生 或 0912"
              style={{
                width: "100%",
                padding: "8px 11px",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${CIS.cardBorder}`,
                borderRadius: CIS.radiusSm,
                color: CIS.text,
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          {[
            {
              name: "district",
              label: "意向區域",
              value: sp.district,
              options: [{ v: "", l: "全部區域" }, ...DISTRICTS.map((d) => ({ v: d.key, l: d.label }))],
            },
            {
              name: "stage",
              label: "階段",
              value: sp.stage,
              options: [{ v: "", l: "全部階段" }, ...STAGES.map((s) => ({ v: s.key, l: s.label }))],
            },
            {
              name: "grade",
              label: "資料等級",
              value: sp.grade,
              options: [
                { v: "", l: "全部" },
                { v: "A", l: "A（80%+）" },
                { v: "B", l: "B（50-79%）" },
                { v: "C", l: "C（20-49%）" },
                { v: "D", l: "D（20%-）" },
              ],
            },
            {
              name: "order",
              label: "排序",
              value: sp.order,
              options: [
                { v: "heat", l: "互動熱度" },
                { v: "completeness", l: "資料完整度" },
                { v: "recent", l: "最近聯絡" },
                { v: "created", l: "建檔時間" },
              ],
            },
          ].map((f) => (
            <div key={f.name} style={{ flex: "1 1 130px" }}>
              <label style={{ display: "block", fontSize: 11, color: CIS.textMute, marginBottom: 5 }}>
                {f.label}
              </label>
              <select
                name={f.name}
                defaultValue={f.value ?? ""}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${CIS.cardBorder}`,
                  borderRadius: CIS.radiusSm,
                  color: CIS.text,
                  fontSize: 13,
                  outline: "none",
                }}
              >
                {f.options.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: CIS.textSub,
              padding: "8px 0",
              cursor: "pointer",
            }}
          >
            <input type="checkbox" name="dormant" value="1" defaultChecked={sp.dormant === "1"} />
            只看沉睡
          </label>

          <button
            type="submit"
            style={{
              padding: "9px 20px",
              borderRadius: CIS.radiusSm,
              border: "none",
              background: CIS.blue,
              color: "#1a1200",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            篩選
          </button>
        </form>

        {/* 命中數 */}
        <div style={{ fontSize: 12.5, color: CIS.textSub, marginBottom: 10 }}>
          符合條件 <strong style={{ color: CIS.blueSoft, fontSize: 15 }}>{total}</strong> 位買方
          {rows.length < total && `（顯示前 ${rows.length} 筆）`}
        </div>

        {/* 名單 */}
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => {
            const missing = missingOf(r);
            const wanted = parseJsonArray(r.districts);
            const days = r.last_contact_at
              ? Math.floor((Date.now() - new Date(r.last_contact_at).getTime()) / 86400_000)
              : null;
            const stage = STAGES.find((s) => s.key === r.stage);

            return (
              <Link
                key={r.id}
                href={`/admin/buyers/${r.id}`}
                style={{
                  display: "block",
                  background: CIS.card,
                  border: `1px solid ${CIS.cardBorder}`,
                  borderRadius: CIS.radius,
                  padding: "14px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  {/* 完整度圓標 */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      border: `2px solid ${CHIP[GRADE_TONE[r.grade] ?? "neutral"].color}`,
                      color: CHIP[GRADE_TONE[r.grade] ?? "neutral"].color,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {r.completeness_pct}%
                  </div>

                  {/* 主要資訊 */}
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{r.name || "（未留姓名）"}</span>
                      {stage && <Chip tone={stage.tone as ChipTone}>{stage.label}</Chip>}
                      {r.broadcast_opt_out === 1 && <Chip tone="danger">已退出推播</Chip>}
                      {days !== null && days > DORMANT_DAYS && <Chip tone="warn">{days} 天沒聯絡</Chip>}
                    </div>
                    <div style={{ fontSize: 12.5, color: CIS.textMute, marginTop: 4 }}>
                      {formatPhone(r.phone_norm) || "無電話"}
                      {wanted.length > 0 && `　·　${wanted.map(districtLabel).join("、")}`}
                    </div>
                  </div>

                  {/* 需求摘要 */}
                  <div style={{ flex: "1 1 180px", fontSize: 12.5, color: CIS.textSub }}>
                    {r.budget_max ? (
                      <span style={{ color: CIS.blueSoft, fontWeight: 700, fontSize: 14 }}>
                        {r.budget_min ? `${r.budget_min}–` : "～"}
                        {r.budget_max} 萬
                      </span>
                    ) : (
                      <span style={{ color: CHIP.warn.color }}>預算未知</span>
                    )}
                    {r.room_min ? `　${r.room_min} 房以上` : ""}
                    {r.parking === "required" ? "　需車位" : ""}
                  </div>

                  {/* 缺什麼 —— 這欄才是行動指引 */}
                  <div style={{ flex: "1 1 200px" }}>
                    {missing.length > 0 ? (
                      <div style={{ fontSize: 12, color: CHIP.warn.color }}>
                        缺：{missing.join("、")}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: CHIP.success.color }}>資料齊全 ✓</div>
                    )}
                    <div style={{ fontSize: 11, color: CIS.textMute, marginTop: 3 }}>
                      熱度 {r.heat_score}
                      {days !== null ? `　·　${days} 天前聯絡` : "　·　尚無互動"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {!empty && rows.length === 0 && (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: CIS.textMute,
                background: CIS.card,
                border: `1px solid ${CIS.cardBorder}`,
                borderRadius: CIS.radius,
                fontSize: 13.5,
              }}
            >
              這組條件沒有符合的買方。把條件放寬一點試試。
            </div>
          )}
        </div>

        {/* 示範資料控制（有示範資料時才出現） */}
        {lstats.demo > 0 && (
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: `1px solid ${CIS.divider}`,
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 12, color: CIS.textMute }}>
              目前有示範資料（名稱都有「示範·」前綴）。要上真實資料前先清掉：
            </span>
            <SeedDemoButton hasDemo />
          </div>
        )}

        {/* 核心區域快捷 */}
        <div style={{ marginTop: 22, fontSize: 12, color: CIS.textMute }}>
          常用區域：
          {CORE_DISTRICTS.map((d) => (
            <Link
              key={d.key}
              href={`/admin/buyers?district=${d.key}`}
              style={{ color: CIS.textSub, textDecoration: "none", marginLeft: 10 }}
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
