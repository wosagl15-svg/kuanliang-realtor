import Link from "next/link";
import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin-check";
import RequireLogin from "@/app/admin/_components/RequireLogin";
import { CIS, CHIP, type ChipTone } from "@/app/admin/_components/cis";
import { getBuyerDetail, parseJsonArray } from "@/lib/buyer";
import { matchListingsForRequirement, type RequirementLike } from "@/lib/buyer-match";
import {
  CONTACT_TYPES,
  ELEVATOR_OPTIONS,
  PARKING_OPTIONS,
  PURPOSE_OPTIONS,
  STAGES,
  districtLabel,
  sourceLabel,
} from "@/lib/buyer-constants";
import { formatPhone } from "@/lib/phone";
import { build591Url, unmappedCriteria } from "@/lib/external-search";
import ContactLogForm from "./ContactLogForm";

export const dynamic = "force-dynamic";

function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const c = CHIP[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        fontSize: 11.5,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section
      style={{
        background: accent ? "rgba(200,150,62,0.07)" : CIS.card,
        border: `1px solid ${accent ? CIS.blue + "44" : CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: accent ? CIS.blueSoft : CIS.textMute,
          letterSpacing: "0.08em",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "7px 0", fontSize: 13.5, alignItems: "baseline" }}>
      <span style={{ color: CIS.textMute, minWidth: 82, flexShrink: 0, fontSize: 12.5 }}>{label}</span>
      <span style={{ color: CIS.text }}>{value}</span>
    </div>
  );
}

export default async function BuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isCurrentUserAdmin())) {
    return <RequireLogin title="買方明細" callbackUrl="/admin/buyers" />;
  }

  const { id } = await params;
  const d = await getBuyerDetail(id);
  if (!d) notFound();

  const b = d.buyer as Record<string, string | number | Date | null>;
  const r = d.requirement as Record<string, string | number | Date | null> | null;
  const stage = STAGES.find((s) => s.key === b.stage);
  const wanted = parseJsonArray((r?.districts as string) ?? null);
  const meta: Record<string, { level: string; evidence: string | null }> = r?.extraction_meta
    ? JSON.parse(r.extraction_meta as string)
    : {};
  const unclear: string[] = r?.soft_json ? (JSON.parse(r.soft_json as string).unclear ?? []) : [];

  // 買方 → 找物件（Rita 那個方向的配案）
  const matching = r
    ? await matchListingsForRequirement(
        {
          ...(r as unknown as RequirementLike),
          communityIds: d.communities.map((c) => c.id),
          tags: d.tags.map((t) => t.name),
        },
        { limit: 6 },
      )
    : { matched: [], total: 0, passedCount: 0 };

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
      <div style={{ maxWidth: 1220, margin: "0 auto" }}>
        <Link href="/admin/buyers" style={{ fontSize: 13, color: CIS.textMute, textDecoration: "none" }}>
          ← 買方名單
        </Link>

        {/* 標題 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "12px 0 20px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{(b.name as string) || "（未留姓名）"}</h1>
          {stage && <Chip tone={stage.tone as ChipTone}>{stage.label}</Chip>}
          <Chip tone={d.priority.tone}>{d.priority.label}</Chip>
          {d.requirementStale && <Chip tone="warn">需求待確認</Chip>}
          {Number(b.broadcast_opt_out) === 1 && <Chip tone="danger">已退出推播</Chip>}
        </div>

        {/* 行動指引 —— 這一條是整頁最重要的東西 */}
        <div
          style={{
            background: CHIP[d.priority.tone].bg,
            border: `1px solid ${CHIP[d.priority.tone].border}`,
            borderRadius: CIS.radius,
            padding: "13px 16px",
            marginBottom: 18,
            fontSize: 13.5,
            color: CHIP[d.priority.tone].color,
          }}
        >
          <strong>下一步：</strong>
          {d.priority.action}
          {d.completeness.topMissing.length > 0 && (
            <span style={{ color: CIS.textSub }}>
              　｜　打電話時順手問：<strong>{d.completeness.topMissing.join("、")}</strong>
            </span>
          )}
        </div>

        {/* 到 591 找符合這位客戶的物件（純連結，不抓取） */}
        {r && (
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "12px 15px",
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${CIS.cardBorder}`,
              borderRadius: CIS.radius,
              marginBottom: 16,
            }}
          >
            <a
              href={build591Url({
                districts: wanted,
                budgetMin: r.budget_min as number | null,
                budgetMax: r.budget_max as number | null,
                roomMin: r.room_min as number | null,
              })}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "9px 18px",
                borderRadius: CIS.radiusSm,
                border: `1px solid ${CIS.blue}`,
                background: "rgba(200,150,62,0.14)",
                color: CIS.blueSoft,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              到 591 找符合的物件 ↗
            </a>
            {(() => {
              const missed = unmappedCriteria({
                districts: wanted,
                parking: r.parking as string,
                elevator: r.elevator as string,
                ageMax: r.age_max as number | null,
              });
              return missed.length ? (
                <span style={{ fontSize: 11.5, color: CHIP.warn.color }}>
                  ⚠ 帶不進去、要自己再篩：{missed.join("、")}
                </span>
              ) : (
                <span style={{ fontSize: 11.5, color: CIS.textMute }}>條件已帶入區域、總價、房數</span>
              );
            })()}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
          {/* 聯絡與狀態 */}
          <Card title="聯絡資料">
            <Row label="電話" value={formatPhone(b.phone_norm as string) || "—"} />
            <Row label="LINE" value={(b.line_user_id as string) || "—"} />
            <Row label="來源" value={sourceLabel(b.source as string)} />
            <Row label="建檔者" value={(b.owner_email as string) || "—"} />
            <Row
              label="最後聯絡"
              value={
                d.daysSinceContact === null ? (
                  <span style={{ color: CHIP.warn.color }}>尚無互動紀錄</span>
                ) : (
                  `${d.daysSinceContact} 天前`
                )
              }
            />
            <Row label="決策人" value={(b.decision_maker as string) || <span style={{ color: CHIP.warn.color }}>未問</span>} />
            <Row label="資金狀況" value={(b.funding_note as string) || "—"} />
            {b.personality_note ? <Row label="個性備註" value={b.personality_note as string} /> : null}
          </Card>

          {/* 當前需求 */}
          <Card title={`當前需求${d.requirementStale ? "（已過 90 天，建議重新確認）" : ""}`}>
            {r ? (
              <>
                <Row
                  label="總價"
                  value={
                    r.budget_max ? (
                      <span style={{ color: CIS.blueSoft, fontWeight: 700, fontSize: 16 }}>
                        {r.budget_min ? `${r.budget_min} – ` : "～ "}
                        {r.budget_max as number} 萬
                        {Number(r.budget_flex_pct) > 0 && (
                          <span style={{ fontSize: 12, color: CIS.textMute }}>
                            （彈性 {Number(r.budget_flex_pct)}%）
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: CHIP.warn.color }}>未問到</span>
                    )
                  }
                />
                <Row label="區域" value={wanted.length ? wanted.map(districtLabel).join("、") : <span style={{ color: CHIP.warn.color }}>未指定</span>} />
                <Row label="房數" value={r.room_min ? `${r.room_min} 房以上` : "不限"} />
                <Row label="電梯" value={ELEVATOR_OPTIONS.find((o) => o.key === r.elevator)?.label ?? "—"} />
                <Row label="車位" value={PARKING_OPTIONS.find((o) => o.key === r.parking)?.label ?? "—"} />
                <Row label="用途" value={PURPOSE_OPTIONS.find((o) => o.key === r.purpose)?.label ?? "—"} />
                {r.size_min || r.size_max ? (
                  <Row label="坪數" value={`${r.size_min ?? "不限"} – ${r.size_max ?? "不限"} 坪`} />
                ) : null}
                {r.age_max ? <Row label="屋齡" value={`${r.age_max} 年以內`} /> : null}
                {d.communities.length > 0 && (
                  <Row label="指定社區" value={d.communities.map((c) => c.name).join("、")} />
                )}
              </>
            ) : (
              <p style={{ color: CIS.textMute, fontSize: 13 }}>還沒有建立需求</p>
            )}
          </Card>

          {/* 完整度 */}
          <Card title="資料完整度與熱度">
            <div style={{ display: "flex", gap: 22, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: CHIP[d.priority.tone].color, lineHeight: 1 }}>
                  {d.completeness.pct}%
                </div>
                <div style={{ fontSize: 11, color: CIS.textMute, marginTop: 4 }}>資料完整度 · {d.completeness.grade} 級</div>
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: CIS.text, lineHeight: 1 }}>{d.heat.score}</div>
                <div style={{ fontSize: 11, color: CIS.textMute, marginTop: 4 }}>互動熱度 · {d.heat.level}</div>
              </div>
            </div>

            {d.heat.reasons.length > 0 && (
              <div style={{ fontSize: 12, color: CIS.textSub, marginBottom: 12 }}>
                {d.heat.reasons.join("　·　")}
              </div>
            )}

            {d.completeness.missing.length > 0 ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: CHIP.warn.color, marginBottom: 7 }}>
                  還缺這些（問完就滿分）
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {d.completeness.missing.map((m) => (
                    <span
                      key={m}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 999,
                        background: CHIP.warn.bg,
                        color: CHIP.warn.color,
                        border: `1px solid ${CHIP.warn.border}`,
                        fontSize: 11.5,
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: CHIP.success.color }}>資料齊全 ✓</div>
            )}

            {unclear.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${CIS.divider}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: CIS.textSub, marginBottom: 6 }}>
                  📋 AI 建議追問
                </div>
                <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, color: CIS.textSub, lineHeight: 1.8 }}>
                  {unclear.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* 標籤 */}
          <Card title="需求標籤">
            {d.tags.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {d.tags.map((t) => (
                  <span
                    key={t.id}
                    style={{
                      padding: "4px 11px",
                      borderRadius: 999,
                      background: t.category === "avoid" ? CHIP.danger.bg : CHIP.info.bg,
                      color: t.category === "avoid" ? CHIP.danger.color : CHIP.info.color,
                      border: `1px solid ${t.category === "avoid" ? CHIP.danger.border : CHIP.info.border}`,
                      fontSize: 12,
                    }}
                  >
                    {t.category === "avoid" ? "🚫 " : ""}
                    {t.name}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: CIS.textMute, fontSize: 13, margin: 0 }}>還沒有標籤</p>
            )}
          </Card>
        </div>

        {/* 配案結果 */}
        <div style={{ marginTop: 16 }}>
          <Card title={`物件庫配案（掃了 ${matching.total} 筆，${matching.passedCount} 筆符合硬條件）`} accent>
            {matching.matched.length === 0 ? (
              <p style={{ color: CIS.textMute, fontSize: 13, margin: 0 }}>
                {matching.total === 0
                  ? "物件庫還是空的，先到買方名單頁塞一批示範物件。"
                  : "目前在售物件沒有符合這位買方硬條件的。"}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {matching.matched.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${CIS.cardBorder}`,
                      borderRadius: CIS.radiusSm,
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        border: `2px solid ${m.match.score >= 80 ? CHIP.success.color : m.match.score >= 60 ? CIS.blue : CIS.textMute}`,
                        color: m.match.score >= 80 ? CHIP.success.color : m.match.score >= 60 ? CIS.blueSoft : CIS.textMute,
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {m.match.score}%
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>
                        {m.title}
                        <span style={{ color: CIS.blueSoft, marginLeft: 10, fontSize: 15 }}>{m.price} 萬</span>
                      </div>
                      <div style={{ fontSize: 12, color: CIS.textMute, marginBottom: 6 }}>
                        {districtLabel(m.district)}　{m.size_ping} 坪　{m.rooms} 房
                        {m.parking_count > 0 ? `　${m.parking_count} 車位` : ""}
                        {m.age_year !== null ? `　屋齡 ${m.age_year} 年` : ""}
                      </div>
                      {m.match.reasons.length > 0 && (
                        <div style={{ fontSize: 12, color: CHIP.success.color, lineHeight: 1.7 }}>
                          ✓ {m.match.reasons.join("　·　")}
                        </div>
                      )}
                      {m.match.cautions.length > 0 && (
                        <div style={{ fontSize: 12, color: CHIP.warn.color, lineHeight: 1.7, marginTop: 3 }}>
                          ⚠ {m.match.cautions.join("　·　")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 互動紀錄 */}
        <div style={{ marginTop: 16 }}>
          <Card title="互動紀錄">
            <ContactLogForm buyerId={id} />
            {d.contacts.length > 0 ? (
              <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                {d.contacts.map((c) => {
                  const t = CONTACT_TYPES.find((x) => x.key === c.type);
                  return (
                    <div
                      key={c.id as string}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: "9px 12px",
                        background: "rgba(255,255,255,0.025)",
                        borderRadius: CIS.radiusSm,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ flexShrink: 0 }}>{t?.emoji ?? "📝"}</span>
                      <span style={{ color: CIS.textMute, flexShrink: 0, fontSize: 12 }}>
                        {new Date(c.occurred_at as Date).toLocaleDateString("zh-TW")}
                      </span>
                      <span style={{ color: CIS.textSub, flexShrink: 0, fontSize: 12 }}>{t?.label}</span>
                      <span style={{ color: CIS.text }}>{(c.content as string) || "—"}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: CIS.textMute, fontSize: 13, marginTop: 14, marginBottom: 0 }}>
                還沒有互動紀錄。每次通話或帶看記一筆，熱度分數才算得準。
              </p>
            )}
          </Card>
        </div>

        {/* 需求歷程 */}
        {d.requirementHistory.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Card title={`需求變更歷程（${d.requirementHistory.length} 次）`}>
              <div style={{ display: "grid", gap: 7 }}>
                {d.requirementHistory.map((h) => (
                  <div key={h.id as string} style={{ fontSize: 12.5, color: CIS.textSub, display: "flex", gap: 12 }}>
                    <span style={{ color: CIS.textMute, minWidth: 92 }}>
                      {new Date(h.created_at as Date).toLocaleDateString("zh-TW")}
                    </span>
                    <span>
                      {h.budget_max ? `${h.budget_min ?? "～"}–${h.budget_max} 萬` : "預算未填"}
                      {h.room_min ? `　${h.room_min} 房以上` : ""}
                      {parseJsonArray(h.districts as string).length
                        ? `　${parseJsonArray(h.districts as string).map(districtLabel).join("、")}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11.5, color: CIS.textMute, marginTop: 12, marginBottom: 0 }}>
                需求會變。保留歷程是為了讓配對永遠用最新的條件，同時看得出客戶的想法怎麼移動。
              </p>
            </Card>
          </div>
        )}

        {/* 原始來源 */}
        {r?.raw_source_text ? (
          <div style={{ marginTop: 16 }}>
            <Card title="原始對話／逐字稿">
              <details>
                <summary style={{ cursor: "pointer", fontSize: 13, color: CIS.textSub }}>
                  展開查看（AI 就是從這段抽出上面的欄位）
                </summary>
                <pre
                  style={{
                    marginTop: 12,
                    whiteSpace: "pre-wrap",
                    fontSize: 12.5,
                    color: CIS.textSub,
                    lineHeight: 1.8,
                    fontFamily: CIS.font,
                    maxHeight: 400,
                    overflow: "auto",
                  }}
                >
                  {r.raw_source_text as string}
                </pre>
              </details>
              {Object.keys(meta).length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${CIS.divider}` }}>
                  <div style={{ fontSize: 11, color: CIS.textMute, marginBottom: 8 }}>欄位判斷依據</div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {Object.entries(meta).map(([field, m]) => (
                      <div key={field} style={{ fontSize: 12, display: "flex", gap: 10 }}>
                        <span
                          style={{
                            color: m.level === "high" ? CHIP.success.color : CHIP.warn.color,
                            minWidth: 96,
                            flexShrink: 0,
                          }}
                        >
                          {field}
                        </span>
                        <span style={{ color: CIS.textMute }}>
                          {m.evidence ? `「${m.evidence}」` : "（無原文）"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  );
}
