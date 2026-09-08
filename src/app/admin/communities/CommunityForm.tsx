"use client";
/**
 * 新增社區（2026-08-12）
 * 別名欄位刻意放在名稱正下方且給了明確提示 —— 這是最容易被跳過、但最致命的欄位。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { DISTRICTS } from "@/lib/buyer-constants";
import { createCommunityAction } from "@/lib/actions/community";

const field: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  background: "#f5f8fd",
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radiusSm,
  color: CIS.text,
  fontSize: FS(13.5),
  fontFamily: CIS.font,
  outline: "none",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: FS(11.5),
  color: CIS.textSub,
  marginBottom: 5,
  fontWeight: 600,
};

export default function CommunityForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [f, setF] = useState({
    name: "",
    aliasesText: "",
    district: "shalu",
    address: "",
    hasElevator: "",
    parkingType: "",
    builtYear: "",
    walkMinHsr: "",
    walkMinTrain: "",
    schoolZone: "",
  });

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const r = await createCommunityAction(f);
      if (r.ok) {
        setMsg({ ok: true, text: `已新增「${f.name}」` });
        setF({
          name: "",
          aliasesText: "",
          district: f.district,
          address: "",
          hasElevator: "",
          parkingType: "",
          builtYear: "",
          walkMinHsr: "",
          walkMinTrain: "",
          schoolZone: "",
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error ?? "新增失敗" });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "10px 20px",
          borderRadius: CIS.radiusSm,
          background: CIS.blue,
          color: CIS.onAccent,
          border: "none",
          fontWeight: 700,
          fontSize: FS(13.5),
          cursor: "pointer",
        }}
      >
        + 新增社區
      </button>
    );
  }

  return (
    <section
      style={{
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: 18,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
        <div>
          <label style={label}>社區正式名稱 *</label>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="例：太子哈佛" style={field} />
        </div>

        <div>
          <label style={label}>
            別名 <span style={{ color: CHIP.warn.color }}>（重要，用逗號分隔）</span>
          </label>
          <input
            value={f.aliasesText}
            onChange={(e) => set("aliasesText", e.target.value)}
            placeholder="哈佛, 哈佛大苑, 太子哈佛B棟"
            style={field}
          />
        </div>

        <div>
          <label style={label}>區域 *</label>
          <select value={f.district} onChange={(e) => set("district", e.target.value)} style={field}>
            {DISTRICTS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={label}>地址</label>
          <input value={f.address} onChange={(e) => set("address", e.target.value)} style={field} />
        </div>

        <div>
          <label style={label}>電梯</label>
          <select value={f.hasElevator} onChange={(e) => set("hasElevator", e.target.value)} style={field}>
            <option value="">不確定</option>
            <option value="yes">有電梯</option>
            <option value="no">無電梯</option>
          </select>
        </div>

        <div>
          <label style={label}>車位型式</label>
          <input
            value={f.parkingType}
            onChange={(e) => set("parkingType", e.target.value)}
            placeholder="平面／機械／車庫"
            style={field}
          />
        </div>

        <div>
          <label style={label}>建成年份</label>
          <input
            type="number"
            value={f.builtYear}
            onChange={(e) => set("builtYear", e.target.value)}
            placeholder="2019"
            style={field}
          />
        </div>

        <div>
          <label style={label}>走路到高鐵（分）</label>
          <input type="number" value={f.walkMinHsr} onChange={(e) => set("walkMinHsr", e.target.value)} style={field} />
        </div>

        <div>
          <label style={label}>走路到火車站（分）</label>
          <input
            type="number"
            value={f.walkMinTrain}
            onChange={(e) => set("walkMinTrain", e.target.value)}
            style={field}
          />
        </div>

        <div>
          <label style={label}>學區</label>
          <input
            value={f.schoolZone}
            onChange={(e) => set("schoolZone", e.target.value)}
            placeholder="北勢國小／公明國中"
            style={field}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !f.name.trim()}
          style={{
            padding: "9px 20px",
            borderRadius: CIS.radiusSm,
            border: "none",
            background: pending || !f.name.trim() ? "#e4e9f2" : CIS.blue,
            color: pending || !f.name.trim() ? CIS.textMute : CIS.onAccent,
            fontWeight: 700,
            fontSize: FS(13),
            cursor: pending || !f.name.trim() ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "新增中…" : "新增社區"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            padding: "9px 16px",
            borderRadius: CIS.radiusSm,
            border: `1px solid ${CIS.cardBorder}`,
            background: "transparent",
            color: CIS.textMute,
            fontSize: FS(13),
            cursor: "pointer",
          }}
        >
          收起
        </button>
        {msg && (
          <span style={{ fontSize: FS(12.5), color: msg.ok ? CHIP.success.color : CHIP.danger.color }}>
            {msg.ok ? "✓" : "⚠️"} {msg.text}
          </span>
        )}
      </div>
    </section>
  );
}
