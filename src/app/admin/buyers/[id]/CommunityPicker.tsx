"use client";
/**
 * 物件／社區名稱輸入 —— 先查內部主檔（2026-08-21）
 *
 * 🔴 這裡不連任何外部網站。打字時查的是我們自己的 community 主檔（含別名），
 *    不抓 591 的原則沒有變。從 591 網址是拿不到社區名的，除非去讀它的頁面。
 *
 * 為什麼一定要接主檔而不是讓他自由打字：
 *   自由輸入會長出「太子哈佛／哈佛／哈佛大苑／太子哈佛B棟」四個社區，
 *   之後「輸入社區撈出所有想買的人」就永遠做不出來。這是這套系統的地基。
 *
 * 型態決定顯示什麼：
 *   電梯大樓／社區 → 顯示社區名
 *   獨棟透天       → 顯示地址（透天沒有社區名，硬填會生出一堆假社區）
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { COMMUNITY_KINDS, DISTRICTS } from "@/lib/buyer-constants";
import { searchCommunitiesAction, quickCreateCommunityAction, type CommunityHit } from "@/lib/actions/buyer";

const field: React.CSSProperties = {
  padding: "9px 12px",
  background: "#ffffff",
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: FS(13.5),
  fontFamily: CIS.font,
  outline: "none",
};

export default function CommunityPicker({
  text,
  onTextChange,
  selected,
  onSelect,
}: {
  text: string;
  onTextChange: (v: string) => void;
  selected: CommunityHit | null;
  onSelect: (c: CommunityHit | null) => void;
}) {
  const [hits, setHits] = useState<CommunityHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKind, setNewKind] = useState<string>("building");
  const [newDistrict, setNewDistrict] = useState<string>("shalu");
  const [newAddress, setNewAddress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  // 打字時查主檔。延遲 250ms，不要每個字都打一次資料庫。
  useEffect(() => {
    if (selected) return;
    const q = text.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const my = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchCommunitiesAction(q);
      if (my !== seq.current) return; // 打字比查詢快，舊結果直接丟掉
      setHits(r);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [text, selected]);

  function doCreate() {
    setErr(null);
    startTransition(async () => {
      const r = await quickCreateCommunityAction({
        name: text.trim(),
        kind: newKind,
        district: newDistrict,
        address: newAddress.trim() || null,
      });
      if (!r.ok || !r.id) {
        setErr(r.error ?? "新增失敗");
        return;
      }
      onSelect({
        id: r.id,
        name: text.trim(),
        district: newDistrict,
        address: newAddress.trim() || null,
        kind: newKind,
        matchKind: "剛新增",
        display: newKind === "house" && newAddress.trim() ? newAddress.trim() : text.trim(),
      });
      setCreating(false);
      setNewAddress("");
    });
  }

  // 已經選定 → 顯示一個可移除的標籤，不再顯示搜尋結果
  if (selected) {
    const kindLabel = COMMUNITY_KINDS.find((k) => k.key === selected.kind)?.label;
    return (
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "9px 12px",
          background: CHIP.info.bg,
          border: `1px solid ${CHIP.info.border}`,
          borderRadius: CIS.radiusSm,
        }}
      >
        <span style={{ fontSize: FS(11), color: CIS.textMute }}>主檔</span>
        <strong style={{ fontSize: FS(13.5), color: CHIP.info.color }}>{selected.display}</strong>
        <span style={{ fontSize: FS(11.5), color: CIS.textSub }}>
          {DISTRICTS.find((d) => d.key === selected.district)?.label ?? selected.district}
          {kindLabel ? ` · ${kindLabel}` : ""}
          {selected.kind !== "house" && selected.address ? ` · ${selected.address}` : ""}
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          style={{
            marginLeft: "auto",
            border: "none",
            background: "transparent",
            color: CIS.textMute,
            fontSize: FS(11.5),
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          換一個
        </button>
      </div>
    );
  }

  const exact = hits.some((h) => h.matchKind === "正式名稱" || h.matchKind === "別名");

  return (
    <div>
      <input
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="物件／社區名稱，例：太子哈佛　（透天請打地址）"
        style={{ ...field, width: "100%", fontWeight: 600 }}
      />

      {/* 主檔比對結果 */}
      {text.trim() && (
        <div style={{ marginTop: 6 }}>
          {searching && <span style={{ fontSize: FS(11), color: CIS.textMute }}>查主檔中…</span>}

          {!searching && hits.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: FS(11), color: CIS.textMute }}>主檔比到：</span>
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelect(h)}
                  style={{
                    padding: "4px 11px",
                    borderRadius: 999,
                    border: `1px solid ${CHIP.info.border}`,
                    background: CHIP.info.bg,
                    color: CHIP.info.color,
                    fontSize: FS(11.5),
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title={`${h.matchKind}${h.address ? ` · ${h.address}` : ""}`}
                >
                  {h.display}
                  <span style={{ fontWeight: 400, opacity: 0.75 }}>
                    {" "}
                    · {DISTRICTS.find((d) => d.key === h.district)?.label ?? h.district}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!searching && !exact && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              style={{
                marginTop: 6,
                padding: "4px 11px",
                borderRadius: 999,
                border: `1px dashed ${CIS.cardBorder}`,
                background: "transparent",
                color: CIS.textSub,
                fontSize: FS(11.5),
                cursor: "pointer",
              }}
            >
              ＋ 主檔沒有「{text.trim()}」，加進去
            </button>
          )}

          {/* 當場建主檔 —— 要業務先跳去社區主檔頁再回來，他就不會建，主檔永遠長不大 */}
          {creating && (
            <div
              style={{
                marginTop: 8,
                padding: "11px 13px",
                background: CIS.panel,
                border: `1px solid ${CIS.panelBorder}`,
                borderRadius: CIS.radiusSm,
              }}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {COMMUNITY_KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setNewKind(k.key)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: `1px solid ${newKind === k.key ? CIS.blue : CIS.cardBorder}`,
                      background: newKind === k.key ? CHIP.info.bg : "transparent",
                      color: newKind === k.key ? CHIP.info.color : CIS.textMute,
                      fontSize: FS(11.5),
                      fontWeight: newKind === k.key ? 700 : 500,
                      cursor: "pointer",
                    }}
                    title={k.hint}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                  style={{ ...field, flex: "0 0 130px" }}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder={newKind === "house" ? "地址（透天必填，用來辨識是哪一間）" : "地址（可留白）"}
                  style={{ ...field, flex: "1 1 240px" }}
                />
                <button
                  type="button"
                  onClick={doCreate}
                  disabled={pending}
                  style={{
                    padding: "9px 18px",
                    borderRadius: CIS.radiusSm,
                    border: "none",
                    background: pending ? "#e4e9f2" : CIS.blue,
                    color: pending ? CIS.textMute : CIS.onAccent,
                    fontSize: FS(12.5),
                    fontWeight: 700,
                    cursor: pending ? "not-allowed" : "pointer",
                  }}
                >
                  {pending ? "新增中…" : "加進主檔"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: CIS.textMute,
                    fontSize: FS(11.5),
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
              </div>
              {err && (
                <p style={{ margin: "7px 0 0", fontSize: FS(11.5), color: CHIP.danger.color }}>⚠️ {err}</p>
              )}
              <p style={{ margin: "7px 0 0", fontSize: FS(10.5), color: CIS.textMute, lineHeight: 1.6 }}>
                加進主檔之後，這個社區的每一筆帶看都會自動歸到同一個地方——
                之後才問得出「想買太子哈佛的有哪些人」。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
