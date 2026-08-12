"use client";
/**
 * 貼物件描述 → AI 抽欄位 → 確認 → 入庫（2026-08-12）
 * 這是讓物件庫「變真」最快的路：資料是自己的、不靠外部平台、不會過期。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP } from "@/app/admin/_components/cis";
import { DISTRICTS } from "@/lib/buyer-constants";
import type { ListingExtractActionResult } from "@/lib/listing-action-types";
import { extractListingAction, saveListingAction } from "@/lib/actions/listing";

type Extracted = NonNullable<ListingExtractActionResult["data"]>;

const field: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
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

export default function NewListingClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [res, setRes] = useState<ListingExtractActionResult | null>(null);
  const [f, setF] = useState<Extracted | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    const lv = c.level === "medium" ? "有寫但模糊" : c.level === "low" ? "用推的，請確認" : "描述裡明確寫了";
    return c.evidence ? `${lv}｜原文：「${c.evidence}」` : lv;
  };

  const set = <K extends keyof Extracted>(k: K, v: Extracted[K]) =>
    setF((p) => (p ? { ...p, [k]: v } : p));

  function doExtract() {
    setErr(null);
    startTransition(async () => {
      const r = await extractListingAction(text);
      setRes(r);
      if (r.ok && r.data) {
        setF(r.data);
        setCommunityId(r.communityHits?.[0]?.id ?? null);
      }
    });
  }

  function doSave() {
    if (!f) return;
    setSaving(true);
    setErr(null);
    (async () => {
      const r = await saveListingAction({
        title: f.title,
        communityId,
        district: f.district ?? "",
        address: f.address,
        price: f.price,
        sizePing: f.size_ping,
        rooms: f.rooms,
        livingRooms: f.living_rooms,
        baths: f.baths,
        floorNo: f.floor_no,
        totalFloors: f.total_floors,
        ageYear: f.age_year,
        hasElevator: f.has_elevator,
        parkingCount: f.parking_count,
        tags: f.tags,
        note: text,
      });
      setSaving(false);
      if (r.ok) {
        setF(null);
        setRes(null);
        setText("");
        router.refresh();
      } else setErr(r.error ?? "存檔失敗");
    })();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        style={{ background: CIS.card, border: `1px solid ${CIS.cardBorder}`, borderRadius: CIS.radius, padding: 18 }}
      >
        <label style={label}>貼上物件描述（公司內網複製、同事 LINE 丟來的、委託書打的字都可以）</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"例：沙鹿區中山路 太子哈佛 8樓/14樓 權狀38.5坪 3房2廳2衛 平面車位一個 屋齡6年 開價1280萬 可議"}
          style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={doExtract}
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
            {pending ? "解析中…" : "AI 抽出欄位"}
          </button>
          {res?.usage && (
            <span style={{ fontSize: 12, color: CIS.textMute }}>本次花費 NT${res.usage.costTwd}</span>
          )}
        </div>
        {res && !res.ok && <p style={{ marginTop: 10, color: CHIP.danger.color, fontSize: 13 }}>⚠️ {res.error}</p>}
      </section>

      {f && (
        <section
          style={{ background: CIS.card, border: `1px solid ${CIS.cardBorder}`, borderRadius: CIS.radius, padding: 18 }}
        >
          <div style={{ fontSize: 13.5, color: CIS.text, marginBottom: 6 }}>{f.summary}</div>
          {f.price_raw && (
            <div style={{ fontSize: 12.5, color: CHIP.warn.color, marginBottom: 12 }}>
              💰 價格原話：「{f.price_raw}」— 確認這是開價還是底價
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 13 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>物件標題</label>
              <input value={f.title} onChange={(e) => set("title", e.target.value)} style={{ ...field, ...tone("title") }} />
            </div>

            <div>
              <label style={label}>行政區 *</label>
              <select
                value={f.district ?? ""}
                onChange={(e) => set("district", (e.target.value || null) as Extracted["district"])}
                style={{ ...field, ...tone("district") }}
              >
                <option value="">— 請選 —</option>
                {DISTRICTS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={label}>總價（萬）</label>
              <input
                type="number"
                value={f.price ?? ""}
                onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))}
                title={ev("price")}
                style={{ ...field, ...tone("price") }}
              />
            </div>

            <div>
              <label style={label}>權狀坪數</label>
              <input
                type="number"
                value={f.size_ping ?? ""}
                onChange={(e) => set("size_ping", e.target.value === "" ? null : Number(e.target.value))}
                style={{ ...field, ...tone("size_ping") }}
              />
            </div>

            <div>
              <label style={label}>房數</label>
              <input
                type="number"
                value={f.rooms ?? ""}
                onChange={(e) => set("rooms", e.target.value === "" ? null : Number(e.target.value))}
                style={{ ...field, ...tone("rooms") }}
              />
            </div>

            <div>
              <label style={label}>屋齡（年）</label>
              <input
                type="number"
                value={f.age_year ?? ""}
                onChange={(e) => set("age_year", e.target.value === "" ? null : Number(e.target.value))}
                style={{ ...field, ...tone("age_year") }}
              />
            </div>

            <div>
              <label style={label}>樓層 / 總樓</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number"
                  value={f.floor_no ?? ""}
                  onChange={(e) => set("floor_no", e.target.value === "" ? null : Number(e.target.value))}
                  style={field}
                />
                <input
                  type="number"
                  value={f.total_floors ?? ""}
                  onChange={(e) => set("total_floors", e.target.value === "" ? null : Number(e.target.value))}
                  style={field}
                />
              </div>
            </div>

            <div>
              <label style={label}>車位數</label>
              <input
                type="number"
                value={f.parking_count}
                onChange={(e) => set("parking_count", Number(e.target.value) || 0)}
                style={{ ...field, ...tone("parking_count") }}
              />
            </div>

            <div>
              <label style={label}>電梯</label>
              <select
                value={f.has_elevator === null ? "" : f.has_elevator ? "yes" : "no"}
                onChange={(e) => set("has_elevator", e.target.value === "" ? null : e.target.value === "yes")}
                style={{ ...field, ...tone("has_elevator") }}
              >
                <option value="">不確定</option>
                <option value="yes">有電梯</option>
                <option value="no">無電梯</option>
              </select>
            </div>
          </div>

          {res?.communityHits && res.communityHits.length > 0 && (
            <div style={{ marginTop: 15 }}>
              <label style={label}>掛到社區主檔（掛上才能做社區配對）</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {res.communityHits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setCommunityId(communityId === h.id ? null : h.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: `1px solid ${communityId === h.id ? CIS.blue : CIS.cardBorder}`,
                      background: communityId === h.id ? "rgba(200,150,62,0.18)" : "transparent",
                      color: communityId === h.id ? CIS.blueSoft : CIS.textSub,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {communityId === h.id ? "✓ " : ""}
                    {h.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {f.unclear.length > 0 && (
            <div style={{ marginTop: 15, padding: "11px 13px", background: CHIP.warn.bg, borderRadius: CIS.radiusSm }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: CHIP.warn.color, marginBottom: 6 }}>
                📋 要跟屋主／同事確認
              </div>
              <ul style={{ margin: 0, paddingLeft: 17, fontSize: 12.5, color: CIS.textSub, lineHeight: 1.8 }}>
                {f.unclear.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${CIS.divider}` }}>
            {err && <p style={{ color: CHIP.danger.color, fontSize: 13, marginTop: 0 }}>⚠️ {err}</p>}
            <button
              type="button"
              onClick={doSave}
              disabled={saving}
              style={{
                padding: "10px 22px",
                borderRadius: CIS.radiusSm,
                border: "none",
                background: saving ? "rgba(255,255,255,0.08)" : CIS.blue,
                color: saving ? CIS.textMute : "#1a1200",
                fontWeight: 700,
                fontSize: 13.5,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "存檔中…" : "確認存入物件庫"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
