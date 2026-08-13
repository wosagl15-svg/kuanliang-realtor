"use client";
/**
 * 買方名單頁上方的「貼對話建檔」（2026-08-13）
 *
 * 系統擁有者拍板的流程：
 *   貼外部對話 → 解析需求 → 確認 → 存檔 → 名單直接出現在下方
 *   LINE 名稱與電話「由使用者自行輸入」（對話裡常常沒有，或抓到的是別人的）
 *
 * 沒有 ANTHROPIC_API_KEY 也能用 —— 後端會自動改用規則解析。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP } from "@/app/admin/_components/cis";
import {
  DISTRICTS,
  ELEVATOR_OPTIONS,
  PARKING_OPTIONS,
  PURPOSE_OPTIONS,
  ROOM_OPTIONS,
} from "@/lib/buyer-constants";
import { URGENCY_LABELS, type ExtractActionResult } from "@/lib/buyer-action-types";
import { build591Url, mappedSummary, unmappedCriteria } from "@/lib/external-search";
import { extractBuyerAction, saveBuyerAction } from "@/lib/actions/buyer";

type Extracted = NonNullable<ExtractActionResult["data"]>;

const field: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: 13.5,
  fontFamily: CIS.font,
  outline: "none",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  color: CIS.textSub,
  marginBottom: 5,
  fontWeight: 600,
};

export default function QuickAddBuyer() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [res, setRes] = useState<ExtractActionResult | null>(null);
  const [f, setF] = useState<Extracted | null>(null);

  // 🔴 姓名與電話一律由使用者自行輸入 —— 對話裡抓到的只當預設值
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ id: string; name: string } | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const meta = new Map((f?.confidence ?? []).map((c) => [c.field, c] as const));
  const tone = (k: string): React.CSSProperties => {
    const c = meta.get(k);
    return c && c.level !== "high"
      ? { borderColor: CHIP.warn.border, background: "rgba(245,158,11,0.06)" }
      : {};
  };
  const ev = (k: string) => {
    const c = meta.get(k);
    if (!c) return undefined;
    const lv = c.level === "medium" ? "有講但模糊，請確認" : c.level === "low" ? "用推的，請確認" : "對話裡明確講了";
    return c.evidence ? `${lv}｜原文：「${c.evidence}」` : lv;
  };

  const set = <K extends keyof Extracted>(k: K, v: Extracted[K]) =>
    setF((p) => (p ? { ...p, [k]: v } : p));

  function reset() {
    setText("");
    setRes(null);
    setF(null);
    setName("");
    setPhone("");
    setLineId("");
    setErr(null);
    setConflict(null);
  }

  function doParse() {
    setErr(null);
    setConflict(null);
    setOkMsg(null);
    startTransition(async () => {
      const r = await extractBuyerAction(text, "line");
      setRes(r);
      if (r.ok && r.data) {
        setF(r.data);
        setName((prev) => prev || r.data!.name || "");
        setPhone((prev) => prev || r.data!.phone || r.phonesFound?.[0] || "");
        setLineId((prev) => prev || r.data!.line_id || "");
      } else {
        setErr(r.error ?? "解析失敗");
      }
    });
  }

  function doSave() {
    if (!f) return;
    if (!name.trim() && !phone.trim()) {
      setErr("至少要填姓名或電話，不然這筆資料以後找不回來");
      return;
    }
    setSaving(true);
    setErr(null);
    setConflict(null);
    (async () => {
      const r = await saveBuyerAction({
        name: name.trim(),
        phone: phone.trim(),
        lineUserId: lineId.trim() || null,
        source: "line",
        decisionMaker: f.decision_maker,
        fundingNote: f.funding_note,
        urgency: f.urgency === "unknown" ? null : f.urgency,
        personalityNote: f.personality_note,
        budgetMin: f.budget_min,
        budgetMax: f.budget_max,
        budgetFlexPct: 0,
        districts: f.districts,
        roomMin: f.room_min,
        elevator: f.elevator,
        parking: f.parking,
        purpose: f.purpose,
        sizeMin: f.size_min,
        sizeMax: f.size_max,
        ageMax: f.age_max,
        floorPref: f.floor_pref,
        tagNames: [...f.tags, ...f.avoid],
        communityIds: [],
        rawSourceText: text,
        extractionMeta: Object.fromEntries(
          f.confidence.map((c) => [c.field, { level: c.level, evidence: c.evidence }]),
        ),
        unclear: f.unclear,
      });
      setSaving(false);
      if (r.ok) {
        setOkMsg(`已建檔：${name.trim() || phone.trim()}`);
        reset();
        router.refresh(); // 下方名單立刻更新
      } else {
        setErr(r.error ?? "存檔失敗");
        if (r.conflict) setConflict(r.conflict);
      }
    })();
  }

  if (!open) {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "11px 22px",
            borderRadius: CIS.radiusSm,
            background: CIS.blue,
            color: "#1a1200",
            border: "none",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ＋ 貼對話建檔
        </button>
        <span style={{ fontSize: 12, color: CIS.textMute }}>
          把 LINE 對話貼進來，系統抓出需求，姓名電話你自己填
        </span>
        {okMsg && <span style={{ fontSize: 12.5, color: CHIP.success.color }}>✓ {okMsg}</span>}
      </div>
    );
  }

  return (
    <section
      style={{
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>貼對話建檔</div>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: CIS.textMute,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          收起 ✕
        </button>
      </div>

      {/* 步驟一：貼內容 */}
      <label style={label}>把 LINE 對話、帶看逐字稿、或客戶講的話整段貼進來</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"例：陳先生說想找沙鹿或清水的三房，預算1200萬左右，一定要車位，走路到高鐵站十分鐘內最好，屋齡15年內，太太一起決定"}
        style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
      />

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={doParse}
          disabled={pending || !text.trim()}
          style={{
            padding: "9px 20px",
            borderRadius: CIS.radiusSm,
            border: "none",
            background: pending || !text.trim() ? "rgba(255,255,255,0.08)" : CIS.blue,
            color: pending || !text.trim() ? CIS.textMute : "#1a1200",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: pending || !text.trim() ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "分析中…" : "分析需求"}
        </button>

        {res?.engine === "rules" && (
          <span style={{ fontSize: 12, color: CHIP.warn.color }}>
            規則解析（免費）· 未設 AI 金鑰，欄位請逐一確認
          </span>
        )}
        {res?.engine === "ai" && res.usage && (
          <span style={{ fontSize: 12, color: CIS.textMute }}>AI 解析 · 本次 NT${res.usage.costTwd}</span>
        )}
      </div>

      {/* 步驟二：確認 */}
      {f && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${CIS.divider}` }}>
          <p style={{ fontSize: 13.5, color: CIS.text, margin: "0 0 14px", lineHeight: 1.7 }}>{f.summary}</p>

          {/* 🔴 姓名 / 電話 / LINE：一律自行輸入 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
              gap: 12,
              padding: 14,
              background: "rgba(200,150,62,0.07)",
              border: `1px solid ${CIS.blue}44`,
              borderRadius: CIS.radiusSm,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={label}>姓名／稱呼</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="陳先生"
                style={field}
              />
            </div>
            <div>
              <label style={label}>電話</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912-345-678"
                style={field}
              />
            </div>
            <div>
              <label style={label}>LINE 名稱／ID</label>
              <input
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                placeholder="小陳"
                style={field}
              />
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: CIS.textMute }}>
              這三欄請自己填。對話裡抓到的只是預設值，常常是錯的或抓到別人的號碼。
              {res?.phonesFound && res.phonesFound.length > 1 && (
                <span style={{ color: CHIP.warn.color }}>
                  　⚠ 文中有 {res.phonesFound.length} 支電話：{res.phonesFound.join("、")}
                </span>
              )}
            </div>
          </div>

          {/* 需求欄位 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <div>
              <label style={label}>總價下限（萬）</label>
              <input
                type="number"
                value={f.budget_min ?? ""}
                onChange={(e) => set("budget_min", e.target.value === "" ? null : Number(e.target.value))}
                style={{ ...field, ...tone("budget_min") }}
              />
            </div>
            <div>
              <label style={label}>總價上限（萬）</label>
              <input
                type="number"
                value={f.budget_max ?? ""}
                onChange={(e) => set("budget_max", e.target.value === "" ? null : Number(e.target.value))}
                title={ev("budget_max")}
                style={{ ...field, ...tone("budget_max") }}
              />
            </div>
            <div>
              <label style={label}>最少房數</label>
              <select
                value={f.room_min ?? ""}
                onChange={(e) => set("room_min", e.target.value === "" ? null : Number(e.target.value))}
                style={{ ...field, ...tone("room_min") }}
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
              <label style={label}>電梯</label>
              <select
                value={f.elevator}
                onChange={(e) => set("elevator", e.target.value as Extracted["elevator"])}
                style={{ ...field, ...tone("elevator") }}
              >
                {ELEVATOR_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>車位</label>
              <select
                value={f.parking}
                onChange={(e) => set("parking", e.target.value as Extracted["parking"])}
                style={{ ...field, ...tone("parking") }}
              >
                {PARKING_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>用途</label>
              <select
                value={f.purpose}
                onChange={(e) => set("purpose", e.target.value as Extracted["purpose"])}
                style={{ ...field, ...tone("purpose") }}
              >
                {PURPOSE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>屋齡上限（年）</label>
              <input
                type="number"
                value={f.age_max ?? ""}
                onChange={(e) => set("age_max", e.target.value === "" ? null : Number(e.target.value))}
                style={{ ...field, ...tone("age_max") }}
              />
            </div>
            <div>
              <label style={label}>急迫度</label>
              <select
                value={f.urgency}
                onChange={(e) => set("urgency", e.target.value as Extracted["urgency"])}
                style={{ ...field, ...tone("urgency") }}
              >
                {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>決策人</label>
              <input
                value={f.decision_maker ?? ""}
                onChange={(e) => set("decision_maker", e.target.value || null)}
                placeholder="太太一起決定"
                title={ev("decision_maker")}
                style={{ ...field, ...tone("decision_maker") }}
              />
            </div>
          </div>

          {/* 區域 */}
          <div style={{ marginTop: 14 }}>
            <label style={label}>意向區域</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DISTRICTS.filter((d) => d.core || f.districts.includes(d.key)).map((d) => {
                const on = f.districts.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() =>
                      set("districts", on ? f.districts.filter((x) => x !== d.key) : [...f.districts, d.key])
                    }
                    style={{
                      padding: "6px 13px",
                      borderRadius: 999,
                      border: `1px solid ${on ? CIS.blue : CIS.cardBorder}`,
                      background: on ? "rgba(200,150,62,0.18)" : "transparent",
                      color: on ? CIS.blueSoft : CIS.textMute,
                      fontSize: 12.5,
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

          {/* 標籤 */}
          {(f.tags.length > 0 || f.avoid.length > 0) && (
            <div style={{ marginTop: 14 }}>
              <label style={label}>抓到的標籤（點一下移除）</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {f.tags.map((t) => (
                  <span
                    key={t}
                    onClick={() => set("tags", f.tags.filter((x) => x !== t))}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 999,
                      background: CHIP.info.bg,
                      color: CHIP.info.color,
                      border: `1px solid ${CHIP.info.border}`,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {t} ×
                  </span>
                ))}
                {f.avoid.map((t) => (
                  <span
                    key={t}
                    onClick={() => set("avoid", f.avoid.filter((x) => x !== t))}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 999,
                      background: CHIP.danger.bg,
                      color: CHIP.danger.color,
                      border: `1px solid ${CHIP.danger.border}`,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    🚫 {t} ×
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 待追問 */}
          {f.unclear.length > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: "11px 13px",
                background: CHIP.warn.bg,
                borderRadius: CIS.radiusSm,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: CHIP.warn.color, marginBottom: 6 }}>
                📋 下次聯絡照著問，資料就完整了
              </div>
              <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, color: CIS.textSub, lineHeight: 1.85 }}>
                {f.unclear.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 導向 591 找物件 —— 只開連結，不抓取 */}
          {(() => {
            const criteria = {
              districts: f.districts,
              budgetMin: f.budget_min,
              budgetMax: f.budget_max,
              // budget_raw 有值 = 原話是「800萬左右」這種模糊表述
              budgetFuzzy: !!f.budget_raw,
              roomMin: f.room_min,
              sizeMin: f.size_min,
              sizeMax: f.size_max,
              parking: f.parking,
              elevator: f.elevator,
              ageMax: f.age_max,
              tags: [...f.tags, ...f.avoid],
            };
            const url = build591Url(criteria);
            const mapped = mappedSummary(criteria);
            const missed = unmappedCriteria(criteria);
            return (
              <div
                style={{
                  marginTop: 14,
                  padding: "13px 15px",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${CIS.cardBorder}`,
                  borderRadius: CIS.radiusSm,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <a
                    href={url}
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
                    到 591 找符合這個客戶的物件 ↗
                  </a>
                  <span style={{ fontSize: 11.5, color: CIS.textMute, lineHeight: 1.8 }}>
                    已帶入：{mapped.join("　·　") || "（尚無可帶入的條件）"}
                  </span>
                </div>
                {missed.length > 0 && (
                  <div style={{ fontSize: 11.5, color: CHIP.warn.color, marginTop: 8, lineHeight: 1.7 }}>
                    ⚠ 591 連結帶不進去、要在對方站上自己再篩：{missed.join("、")}
                  </div>
                )}
                <div style={{ fontSize: 11, color: CIS.textMute, marginTop: 6, lineHeight: 1.7 }}>
                  這是純連結，開新分頁到 591 看他們當下最新的物件。系統不抓取也不儲存任何 591 內容。
                </div>
              </div>
            );
          })()}

          {/* 存檔 */}
          <div style={{ marginTop: 16 }}>
            {err && (
              <p style={{ color: CHIP.danger.color, fontSize: 13, margin: "0 0 10px" }}>
                ⚠️ {err}
                {conflict && (
                  <a
                    href={`/admin/buyers/${conflict.id}`}
                    style={{ color: CIS.blueSoft, marginLeft: 10, textDecoration: "underline" }}
                  >
                    查看那筆 →
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
                background: saving ? "rgba(255,255,255,0.08)" : CIS.blue,
                color: saving ? CIS.textMute : "#1a1200",
                fontWeight: 700,
                fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "存檔中…" : "確認建檔"}
            </button>
            <span style={{ fontSize: 12, color: CIS.textMute, marginLeft: 12 }}>
              存檔後直接出現在下方名單
            </span>
          </div>
        </div>
      )}

      {res && !res.ok && !f && (
        <p style={{ marginTop: 12, color: CHIP.danger.color, fontSize: 13 }}>⚠️ {res.error}</p>
      )}
    </section>
  );
}
