"use client";
/**
 * 貼上 → AI 解析 → 人工確認 → 存檔（2026-08-12）
 *
 * 🔴 這頁的設計核心是「不要讓 AI 直接決定」：
 *   - 信心不足的欄位標黃，滑過去看得到原文出處
 *   - 沒抽到的欄位留白，不填假值
 *   - 「下次要問客戶」清單直接列出來，業務照著問就能把資料補完整
 *   - 一定要按「確認存檔」才寫進資料庫
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import {
  DISTRICTS,
  ELEVATOR_OPTIONS,
  PARKING_OPTIONS,
  PURPOSE_OPTIONS,
  ROOM_OPTIONS,
} from "@/lib/buyer-constants";
import { URGENCY_LABELS, type ExtractActionResult } from "@/lib/buyer-action-types";
import { extractBuyerAction, saveBuyerAction } from "@/lib/actions/buyer";
import type { SourceKind } from "@/lib/buyer-extract";

type Extracted = NonNullable<ExtractActionResult["data"]>;

const SOURCE_KINDS: Array<{ key: SourceKind; label: string; hint: string; emoji: string }> = [
  { key: "line", label: "LINE 對話", hint: "整段複製貼上即可，含房仲自己講的也沒關係", emoji: "💬" },
  { key: "transcript", label: "錄音逐字稿", hint: "帶看或面談的逐字稿，寒暄離題會自動忽略", emoji: "🎙️" },
  { key: "manual", label: "自己打描述", hint: "用一段話描述這個客戶要什麼", emoji: "✍️" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  background: "#f5f8fd",
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: FS(14),
  fontFamily: CIS.font,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: FS(12),
  color: CIS.textSub,
  marginBottom: 5,
  fontWeight: 600,
};

export default function NewBuyerClient({
  initialText = "",
  fromCase = null,
}: {
  /** 從別的頁（例：每日工作台的某場約）帶過來的內容，直接填進貼上框 */
  initialText?: string;
  /** 這筆是從哪個預約案件轉過來的，顯示用 */
  fromCase?: string | null;
} = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 從預約轉過來時預設「自己打描述」：內容是系統整理的，不是 LINE 原文
  const [kind, setKind] = useState<SourceKind>(initialText ? "manual" : "line");
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<ExtractActionResult | null>(null);
  const [form, setForm] = useState<Extracted | null>(null);
  const [phoneOverride, setPhoneOverride] = useState("");
  const [pickedCommunities, setPickedCommunities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: string; name: string } | null>(null);

  const meta = new Map(
    (form?.confidence ?? []).map((c) => [c.field, c] as const),
  );

  /** 信心不足的欄位要標黃 —— 這是「不要編造」鐵律的視覺化 */
  function fieldTone(field: string): React.CSSProperties {
    const c = meta.get(field);
    if (!c) return {};
    if (c.level === "high") return {};
    return { borderColor: CHIP.warn.border, background: "rgba(245,158,11,0.06)" };
  }

  function evidenceOf(field: string): string | undefined {
    const c = meta.get(field);
    if (!c) return undefined;
    const lv = c.level === "medium" ? "有講但模糊" : c.level === "low" ? "用推的，請確認" : "客戶明確講了";
    return c.evidence ? `${lv}｜原文：「${c.evidence}」` : lv;
  }

  function doExtract() {
    setSaveError(null);
    setConflict(null);
    startTransition(async () => {
      const r = await extractBuyerAction(text, kind);
      setResult(r);
      if (r.ok && r.data) {
        setForm(r.data);
        setPhoneOverride(r.data.phone ?? r.phonesFound?.[0] ?? "");
        setPickedCommunities([]);
      }
    });
  }

  function doSave() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setConflict(null);
    (async () => {
      const r = await saveBuyerAction({
        name: form.name ?? "",
        phone: phoneOverride,
        lineUserId: form.line_id,
        source: kind === "transcript" ? "transcript" : kind === "line" ? "line" : "manual",
        decisionMaker: form.decision_maker,
        fundingNote: form.funding_note,
        urgency: form.urgency === "unknown" ? null : form.urgency,
        personalityNote: form.personality_note,
        budgetMin: form.budget_min,
        budgetMax: form.budget_max,
        budgetFlexPct: 0,
        districts: form.districts,
        roomMin: form.room_min,
        elevator: form.elevator,
        parking: form.parking,
        purpose: form.purpose,
        sizeMin: form.size_min,
        sizeMax: form.size_max,
        ageMax: form.age_max,
        floorPref: form.floor_pref,
        tagNames: [...form.tags, ...form.avoid],
        communityIds: pickedCommunities,
        rawSourceText: text,
        extractionMeta: Object.fromEntries(
          form.confidence.map((c) => [c.field, { level: c.level, evidence: c.evidence }]),
        ),
        unclear: form.unclear,
      });
      setSaving(false);
      if (r.ok && r.buyerId) {
        router.push(`/admin/buyers/${r.buyerId}`);
      } else {
        setSaveError(r.error ?? "存檔失敗");
        if (r.conflict) setConflict(r.conflict);
      }
    })();
  }

  const set = <K extends keyof Extracted>(k: K, v: Extracted[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {fromCase && (
        <div
          style={{
            fontSize: FS(12),
            fontWeight: 600,
            color: CHIP.info.color,
            background: CHIP.info.bg,
            border: `1px solid ${CHIP.info.border}`,
            borderRadius: CIS.radiusSm,
            padding: "9px 13px",
          }}
        >
          🏠 從預約案件 <b>{fromCase}</b> 轉過來的買方線。內容已帶入，
          把當場聊到的區域、預算、格局補在後面再解析。
        </div>
      )}

      {/* ---- Step 1：貼上內容 ---- */}
      <section
        style={{
          background: CIS.card,
          border: `1px solid ${CIS.cardBorder}`,
          borderRadius: CIS.radius,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {SOURCE_KINDS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setKind(s.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: `1px solid ${kind === s.key ? CIS.blue : CIS.cardBorder}`,
                background: kind === s.key ? "#dfe9fb" : "transparent",
                color: kind === s.key ? CIS.blueSoft : CIS.textSub,
                fontSize: FS(13),
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: FS(12), color: CIS.textMute, margin: "0 0 10px" }}>
          {SOURCE_KINDS.find((s) => s.key === kind)?.hint}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={
            kind === "transcript"
              ? "把 30 分鐘的逐字稿整段貼進來，系統只會抽跟買房需求有關的部分…"
              : kind === "line"
                ? "把跟客戶的 LINE 對話整段貼進來…"
                : "例：陳先生，想找沙鹿或清水三房，預算 1200 萬上下，一定要車位，走路到高鐵站十分鐘內最好…"
          }
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={doExtract}
            disabled={pending || !text.trim()}
            style={{
              padding: "10px 20px",
              borderRadius: CIS.radiusSm,
              border: "none",
              background: pending || !text.trim() ? "#e4e9f2" : CIS.blue,
              color: pending || !text.trim() ? CIS.textMute : CIS.onAccent,
              fontWeight: 700,
              fontSize: FS(14),
              cursor: pending || !text.trim() ? "not-allowed" : "pointer",
            }}
          >
            {pending ? "解析中…" : "AI 解析"}
          </button>
          <span style={{ fontSize: FS(12), color: CIS.textMute }}>
            約 {Math.max(1, Math.ceil(text.length / 1000))} 千字
            {result?.usage ? `｜本次花費 NT$${result.usage.costTwd}` : "｜每次約 NT$1"}
          </span>
        </div>

        {result && !result.ok && (
          <p style={{ marginTop: 12, color: CHIP.danger.color, fontSize: FS(13) }}>⚠️ {result.error}</p>
        )}
      </section>

      {/* ---- Step 2：確認與修正 ---- */}
      {form && (
        <>
          {/* 摘要 + 待確認 */}
          <section
            style={{
              background: "#f0f5fd",
              border: `1px solid ${CIS.blue}44`,
              borderRadius: CIS.radius,
              padding: 18,
            }}
          >
            <div style={{ fontSize: FS(11), fontWeight: 700, color: CIS.blueSoft, letterSpacing: "0.08em", marginBottom: 8 }}>
              AI 讀出來的重點
            </div>
            <p style={{ margin: 0, fontSize: FS(14), color: CIS.text, lineHeight: 1.7 }}>{form.summary}</p>

            {form.unclear.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${CIS.divider}` }}>
                <div style={{ fontSize: FS(12), fontWeight: 700, color: CHIP.warn.color, marginBottom: 8 }}>
                  📋 下次聯絡要問這些（問完資料就完整了）
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: FS(13), color: CIS.textSub, lineHeight: 1.9 }}>
                  {form.unclear.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 欄位表單 */}
          <section
            style={{
              background: CIS.card,
              border: `1px solid ${CIS.cardBorder}`,
              borderRadius: CIS.radius,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: FS(11), fontWeight: 700, color: CIS.textMute, letterSpacing: "0.08em" }}>
                確認欄位（黃底 = AI 沒把握，請核對）
              </div>
              <div style={{ fontSize: FS(11), color: CIS.textMute }}>滑鼠移到欄位可看原文出處</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <div>
                <label style={labelStyle}>姓名／稱呼</label>
                <input
                  value={form.name ?? ""}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="例：陳先生、林小姐一家"
                  title={evidenceOf("name")}
                  style={{ ...inputStyle, ...fieldTone("name") }}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  電話
                  {result?.phonesFound && result.phonesFound.length > 1 && (
                    <span style={{ color: CHIP.warn.color, marginLeft: 6 }}>
                      （文中有 {result.phonesFound.length} 支）
                    </span>
                  )}
                </label>
                <input
                  value={phoneOverride}
                  onChange={(e) => setPhoneOverride(e.target.value)}
                  placeholder="0912-345-678"
                  title={evidenceOf("phone")}
                  style={{ ...inputStyle, ...fieldTone("phone") }}
                />
              </div>

              <div>
                <label style={labelStyle}>總價下限（萬）</label>
                <input
                  type="number"
                  value={form.budget_min ?? ""}
                  onChange={(e) => set("budget_min", e.target.value === "" ? null : Number(e.target.value))}
                  style={{ ...inputStyle, ...fieldTone("budget_min") }}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  總價上限（萬）
                  {form.budget_raw && (
                    <span style={{ color: CHIP.warn.color, fontWeight: 400, marginLeft: 6 }}>
                      原話：「{form.budget_raw}」
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={form.budget_max ?? ""}
                  onChange={(e) => set("budget_max", e.target.value === "" ? null : Number(e.target.value))}
                  title={evidenceOf("budget_max")}
                  style={{ ...inputStyle, ...fieldTone("budget_max") }}
                />
              </div>

              <div>
                <label style={labelStyle}>最少房數</label>
                <select
                  value={form.room_min ?? ""}
                  onChange={(e) => set("room_min", e.target.value === "" ? null : Number(e.target.value))}
                  style={{ ...inputStyle, ...fieldTone("room_min") }}
                >
                  <option value="">未提到</option>
                  {ROOM_OPTIONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>電梯</label>
                <select
                  value={form.elevator}
                  onChange={(e) => set("elevator", e.target.value as Extracted["elevator"])}
                  style={{ ...inputStyle, ...fieldTone("elevator") }}
                >
                  {ELEVATOR_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>車位</label>
                <select
                  value={form.parking}
                  onChange={(e) => set("parking", e.target.value as Extracted["parking"])}
                  style={{ ...inputStyle, ...fieldTone("parking") }}
                >
                  {PARKING_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>購屋用途</label>
                <select
                  value={form.purpose}
                  onChange={(e) => set("purpose", e.target.value as Extracted["purpose"])}
                  style={{ ...inputStyle, ...fieldTone("purpose") }}
                >
                  {PURPOSE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.emoji} {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>坪數下限</label>
                <input
                  type="number"
                  value={form.size_min ?? ""}
                  onChange={(e) => set("size_min", e.target.value === "" ? null : Number(e.target.value))}
                  style={{ ...inputStyle, ...fieldTone("size_min") }}
                />
              </div>

              <div>
                <label style={labelStyle}>屋齡上限（年）</label>
                <input
                  type="number"
                  value={form.age_max ?? ""}
                  onChange={(e) => set("age_max", e.target.value === "" ? null : Number(e.target.value))}
                  style={{ ...inputStyle, ...fieldTone("age_max") }}
                />
              </div>

              <div>
                <label style={labelStyle}>急迫度</label>
                <select
                  value={form.urgency}
                  onChange={(e) => set("urgency", e.target.value as Extracted["urgency"])}
                  style={{ ...inputStyle, ...fieldTone("urgency") }}
                >
                  {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>決策人（最常漏，但最影響成交）</label>
                <input
                  value={form.decision_maker ?? ""}
                  onChange={(e) => set("decision_maker", e.target.value || null)}
                  placeholder="例：太太決定、要問爸媽"
                  title={evidenceOf("decision_maker")}
                  style={{ ...inputStyle, ...fieldTone("decision_maker") }}
                />
              </div>
            </div>

            {/* 區域 */}
            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>意向區域</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {DISTRICTS.map((d) => {
                  const on = form.districts.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() =>
                        set(
                          "districts",
                          on ? form.districts.filter((x) => x !== d.key) : [...form.districts, d.key],
                        )
                      }
                      style={{
                        padding: "6px 13px",
                        borderRadius: 999,
                        border: `1px solid ${on ? CIS.blue : CIS.cardBorder}`,
                        background: on ? "#dfe9fb" : "transparent",
                        color: on ? CIS.blueSoft : CIS.textMute,
                        fontSize: FS(12.5),
                        fontWeight: on ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 社區比對 */}
            {result?.communityMatches && result.communityMatches.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <label style={labelStyle}>客戶提到的社區（掛到主檔才能做社區配對）</label>
                <div style={{ display: "grid", gap: 8 }}>
                  {result.communityMatches.map((cm) => (
                    <div
                      key={cm.query}
                      style={{
                        padding: "10px 12px",
                        background: "#f7f9fd",
                        border: `1px solid ${CIS.cardBorder}`,
                        borderRadius: CIS.radiusSm,
                      }}
                    >
                      <div style={{ fontSize: FS(13), color: CIS.text, marginBottom: 6 }}>
                        「{cm.query}」
                        {cm.hits.length === 0 && (
                          <span style={{ color: CHIP.warn.color, fontSize: FS(12), marginLeft: 8 }}>
                            主檔沒有這個社區 → 請先到「社區主檔」新增
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {cm.hits.map((h) => {
                          const on = pickedCommunities.includes(h.id);
                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() =>
                                setPickedCommunities((p) =>
                                  on ? p.filter((x) => x !== h.id) : [...p, h.id],
                                )
                              }
                              style={{
                                padding: "5px 11px",
                                borderRadius: 999,
                                border: `1px solid ${on ? CIS.blue : CIS.cardBorder}`,
                                background: on ? "#dfe9fb" : "transparent",
                                color: on ? CIS.blueSoft : CIS.textSub,
                                fontSize: FS(12),
                                cursor: "pointer",
                              }}
                            >
                              {on ? "✓ " : ""}
                              {h.name}
                              <span style={{ color: CIS.textMute, marginLeft: 5, fontSize: FS(11) }}>
                                {h.matchKind}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 標籤 */}
            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>需求標籤</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {form.tags.map((t) => (
                  <span
                    key={t}
                    onClick={() => set("tags", form.tags.filter((x) => x !== t))}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 999,
                      background: CHIP.info.bg,
                      color: CHIP.info.color,
                      border: `1px solid ${CHIP.info.border}`,
                      fontSize: FS(12),
                      cursor: "pointer",
                    }}
                    title="點一下移除"
                  >
                    {t} ×
                  </span>
                ))}
                {form.avoid.map((t) => (
                  <span
                    key={t}
                    onClick={() => set("avoid", form.avoid.filter((x) => x !== t))}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 999,
                      background: CHIP.danger.bg,
                      color: CHIP.danger.color,
                      border: `1px solid ${CHIP.danger.border}`,
                      fontSize: FS(12),
                      cursor: "pointer",
                    }}
                    title="避雷項目，點一下移除"
                  >
                    🚫 {t} ×
                  </span>
                ))}
                {form.tags.length === 0 && form.avoid.length === 0 && (
                  <span style={{ fontSize: FS(12), color: CIS.textMute }}>沒抽到標籤</span>
                )}
              </div>
            </div>

            {/* 個性備註 */}
            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>個性／溝通備註</label>
              <textarea
                value={form.personality_note ?? ""}
                onChange={(e) => set("personality_note", e.target.value || null)}
                rows={2}
                placeholder="例：講話很直接、喜歡先看資料再約時間"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* 存檔 */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${CIS.divider}` }}>
              {saveError && (
                <p style={{ color: CHIP.danger.color, fontSize: FS(13), marginTop: 0 }}>
                  ⚠️ {saveError}
                  {conflict && (
                    <a
                      href={`/admin/buyers/${conflict.id}`}
                      style={{ color: CIS.blueSoft, marginLeft: 10, textDecoration: "underline" }}
                    >
                      查看那筆資料 →
                    </a>
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={doSave}
                disabled={saving}
                style={{
                  padding: "11px 24px",
                  borderRadius: CIS.radiusSm,
                  border: "none",
                  background: saving ? "#e4e9f2" : CIS.blue,
                  color: saving ? CIS.textMute : CIS.onAccent,
                  fontWeight: 700,
                  fontSize: FS(14),
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "存檔中…" : "確認存檔"}
              </button>
              <span style={{ fontSize: FS(12), color: CIS.textMute, marginLeft: 12 }}>
                按下去才會寫進資料庫
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
