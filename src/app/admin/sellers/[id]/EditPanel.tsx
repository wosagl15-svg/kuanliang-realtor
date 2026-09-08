"use client";
/**
 * 改屋主基本資料（2026-08-22）
 *
 * 🔴 補的是一個很蠢但很致命的漏洞：詳情頁本來整片基本資料都是唯讀的。
 *    後果是「簽到委託書了要把階段從『還沒簽』改成『委託中』」做不到，
 *    「他今天終於講出底價」也填不進去 —— 而這兩件事正是這張表存在的理由。
 *
 * 為什麼做成「先看、按了才展開改」而不是永遠都是表單：
 *   這頁十次有九次是打電話前三十秒打開來看的，那時候要的是結論不是輸入框。
 *   一整片輸入框還會讓人不小心改到東西。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { SELLER_STAGES, SELL_MOTIVES, PRICE_FLEX } from "@/lib/seller-constants";
import { updateSellerAction } from "@/lib/actions/seller";

const field: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  background: CIS.panel,
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: FS(13),
  fontFamily: CIS.font,
  outline: "none",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: FS(11),
  color: CIS.textSub,
  marginBottom: 4,
  fontWeight: 600,
};

export type EditableSeller = {
  name: string;
  phone: string;
  email: string;
  line: string;
  stage: string;
  motive: string;
  motiveNote: string;
  priceFlex: string;
  askPrice: string;
  bottomPrice: string;
  decisionMaker: string;
  coOwnerNote: string;
  deadlineAt: string;
  mandateStart: string;
  mandateEnd: string;
  mandateKind: string;
  personalityNote: string;
};

export default function EditPanel({ sellerId, initial }: { sellerId: string; initial: EditableSeller }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<EditableSeller>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EditableSeller>(k: K, v: EditableSeller[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    startTransition(() => {
      void (async () => {
        const r = await updateSellerAction(sellerId, {
          name: f.name,
          phone: f.phone || null,
          email: f.email || null,
          lineUserId: f.line || null,
          stage: f.stage as never,
          motive: f.motive,
          motiveNote: f.motiveNote || null,
          priceFlex: f.priceFlex,
          askPrice: f.askPrice ? Number(f.askPrice) : null,
          bottomPrice: f.bottomPrice ? Number(f.bottomPrice) : null,
          decisionMaker: f.decisionMaker || null,
          coOwnerNote: f.coOwnerNote || null,
          deadlineAt: f.deadlineAt || null,
          mandateStart: f.mandateStart || null,
          mandateEnd: f.mandateEnd || null,
          mandateKind: f.mandateKind || null,
          personalityNote: f.personalityNote || null,
        });
        setSaving(false);
        if (!r.ok) {
          setError(r.error ?? "存檔失敗");
          return;
        }
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2200);
        router.refresh(); // 意圖分數會跟著重算，上面那塊要更新
      })();
    });
  }

  if (!open) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "7px 16px",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: FS(12),
            fontWeight: 800,
            fontFamily: CIS.font,
            border: `1px solid ${CIS.blue}`,
            background: CIS.card,
            color: CIS.blueSoft,
          }}
        >
          ✏️ 改基本資料
        </button>
        <span style={{ fontSize: FS(11), color: CIS.textMute }}>
          簽到委託書、他終於講出底價、階段要往前推 —— 都從這裡改。改完意圖分數會自動重算。
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: CIS.panel,
        border: `1px solid ${CIS.blue}`,
        borderRadius: CIS.radiusSm,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: FS(13), fontWeight: 800 }}>✏️ 改基本資料</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => {
            setF(initial);
            setOpen(false);
          }}
          style={{
            padding: "5px 14px",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: FS(11.5),
            fontWeight: 700,
            fontFamily: CIS.font,
            border: `1px solid ${CIS.cardBorder}`,
            background: CIS.card,
            color: CIS.textMute,
          }}
        >
          取消
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: "6px 20px",
            borderRadius: 999,
            border: "none",
            background: saving ? CIS.textMute : saved ? "#0f7a45" : CIS.blue,
            color: CIS.onAccent,
            fontSize: FS(12),
            fontWeight: 800,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: CIS.font,
          }}
        >
          {saving ? "存檔中…" : saved ? "✓ 已存" : "存檔"}
        </button>
      </div>

      {/* 階段 —— 最常改的一個，放最上面 */}
      <div style={{ marginBottom: 14 }}>
        <label style={label}>委託階段</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SELLER_STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => set("stage", s.key)}
              title={s.hint}
              style={{
                padding: "6px 13px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: FS(12),
                fontWeight: 700,
                fontFamily: CIS.font,
                border: `1px solid ${f.stage === s.key ? CIS.blue : CIS.cardBorder}`,
                background: f.stage === s.key ? "#dfe9fb" : CIS.card,
                color: f.stage === s.key ? CIS.blueSoft : CIS.textSub,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 動機 */}
      <div style={{ marginBottom: 14 }}>
        <label style={label}>賣的動機</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SELL_MOTIVES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => set("motive", m.key)}
              title={m.hint}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: FS(12),
                fontWeight: 700,
                fontFamily: CIS.font,
                border: `1px solid ${f.motive === m.key ? CIS.blue : CIS.cardBorder}`,
                background: f.motive === m.key ? "#dfe9fb" : CIS.card,
                color: f.motive === m.key ? CIS.blueSoft : CIS.textSub,
              }}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 價格態度 */}
      <div style={{ marginBottom: 14 }}>
        <label style={label}>價格態度</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRICE_FLEX.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => set("priceFlex", p.key)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: FS(12),
                fontWeight: 700,
                fontFamily: CIS.font,
                border: `1px solid ${f.priceFlex === p.key ? CIS.blue : CIS.cardBorder}`,
                background: f.priceFlex === p.key ? "#dfe9fb" : CIS.card,
                color: f.priceFlex === p.key ? CIS.blueSoft : CIS.textSub,
              }}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        <div>
          <label style={label}>屋主稱呼</label>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} style={field} />
        </div>
        <div>
          <label style={label}>電話</label>
          <input value={f.phone} onChange={(e) => set("phone", e.target.value)} style={field} />
        </div>
        <div>
          <label style={label}>Email</label>
          <input value={f.email} onChange={(e) => set("email", e.target.value)} style={field} />
        </div>
        <div>
          <label style={label}>LINE</label>
          <input value={f.line} onChange={(e) => set("line", e.target.value)} style={field} />
        </div>
        <div>
          <label style={label}>目前開價（萬）</label>
          <input
            type="number"
            value={f.askPrice}
            onChange={(e) => set("askPrice", e.target.value)}
            style={field}
          />
        </div>
        <div>
          <label style={label}>他透露的底價（萬）</label>
          <input
            type="number"
            value={f.bottomPrice}
            onChange={(e) => set("bottomPrice", e.target.value)}
            style={field}
            placeholder="只有他自己講過才填"
          />
        </div>
        <div>
          <label style={label}>誰能點頭</label>
          <input
            value={f.decisionMaker}
            onChange={(e) => set("decisionMaker", e.target.value)}
            style={field}
            placeholder="例：太太說了算"
          />
        </div>
        <div>
          <label style={label}>共有人狀況</label>
          <input
            value={f.coOwnerNote}
            onChange={(e) => set("coOwnerNote", e.target.value)}
            style={field}
            placeholder="例：三兄妹共有"
          />
        </div>
        <div>
          <label style={label}>他說的期限</label>
          <input type="date" value={f.deadlineAt} onChange={(e) => set("deadlineAt", e.target.value)} style={field} />
        </div>
        <div>
          <label style={label}>委託起</label>
          <input
            type="date"
            value={f.mandateStart}
            onChange={(e) => set("mandateStart", e.target.value)}
            style={field}
          />
        </div>
        <div>
          <label style={label}>委託迄</label>
          <input type="date" value={f.mandateEnd} onChange={(e) => set("mandateEnd", e.target.value)} style={field} />
        </div>
        <div>
          <label style={label}>委託型態</label>
          <select value={f.mandateKind} onChange={(e) => set("mandateKind", e.target.value)} style={field}>
            <option value="">未填</option>
            <option value="exclusive">專任委託</option>
            <option value="general">一般委託</option>
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={label}>他實際怎麼說的（動機備註）</label>
          <textarea
            value={f.motiveNote}
            onChange={(e) => set("motiveNote", e.target.value)}
            rows={2}
            style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
          />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={label}>個性備註（怎麼跟他相處）</label>
          <input
            value={f.personalityNote}
            onChange={(e) => set("personalityNote", e.target.value)}
            style={field}
            placeholder="例：話少、不喜歡被催，講數據比講感情有效"
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            fontSize: FS(12),
            color: CHIP.danger.color,
            background: CHIP.danger.bg,
            border: `1px solid ${CHIP.danger.border}`,
            borderRadius: CIS.radiusSm,
            padding: "9px 13px",
            marginTop: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
