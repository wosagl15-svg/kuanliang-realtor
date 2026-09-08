"use client";
/**
 * 改一筆已記錄的推案／帶看結果（2026-08-21）
 *
 * 為什麼一定要能改：反應是當場憑印象按的，回辦公室常會想到
 * 「其實他是嫌價格，不是嫌屋況」。不能改的話業務下次就不記了 ——
 * 而整個「推案熱、看完冷」的落差分析，全靠這張表的準確度。
 *
 * 只改反應與備註。要改物件或類型＝那是另一筆紀錄，請刪掉重記。
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import { REACTIONS } from "@/lib/buyer-constants";
import { updateContactAction, deleteContactAction } from "@/lib/actions/buyer";

export default function EventEditor({
  logId,
  buyerId,
  title,
  reaction,
  note,
}: {
  logId: string;
  buyerId: string;
  /** content 裡的【物件名】那段，改完要原樣寫回去 */
  title: string;
  reaction: string | null;
  note: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<string | null>(reaction);
  const [n, setN] = useState(note);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await updateContactAction({
        logId,
        buyerId,
        // 名稱不變，只換備註 —— 用同樣的【名稱】格式寫回，分組才不會散掉
        content: title ? `【${title}】${n.trim()}` : n.trim(),
        reaction: r,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setErr(res.error ?? "存不起來");
    });
  }

  function remove() {
    setErr(null);
    startTransition(async () => {
      const res = await deleteContactAction(logId, buyerId);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "刪不掉");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          border: "none",
          background: "transparent",
          color: CIS.blueSoft,
          fontSize: FS(10.5),
          cursor: "pointer",
          textDecoration: "underline",
          padding: 0,
          flexShrink: 0,
        }}
      >
        改
      </button>
    );
  }

  return (
    <div
      style={{
        flexBasis: "100%",
        marginTop: 6,
        padding: "11px 13px",
        background: CIS.panel,
        border: `1px solid ${CIS.panelBorder}`,
        borderRadius: CIS.radiusSm,
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: FS(11), color: CIS.textSub }}>改成：</span>
        {REACTIONS.map((x) => {
          const on = r === x.key;
          const c = CHIP[x.tone as keyof typeof CHIP];
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setR(on ? null : x.key)}
              style={{
                padding: "4px 11px",
                borderRadius: 999,
                border: `1px solid ${on ? c.border : CIS.cardBorder}`,
                background: on ? c.bg : "transparent",
                color: on ? c.color : CIS.textMute,
                fontSize: FS(11.5),
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {x.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !pending) save();
          }}
          placeholder="備註（為什麼喜歡／不喜歡）"
          style={{
            flex: "1 1 240px",
            padding: "8px 11px",
            background: "#ffffff",
            border: `1px solid ${CIS.cardBorder}`,
            borderRadius: CIS.radiusSm,
            color: CIS.text,
            fontSize: FS(12.5),
            fontFamily: CIS.font,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            padding: "8px 18px",
            borderRadius: CIS.radiusSm,
            border: "none",
            background: pending ? "#e4e9f2" : CIS.blue,
            color: pending ? CIS.textMute : CIS.onAccent,
            fontSize: FS(12.5),
            fontWeight: 700,
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "存檔中…" : "存起來"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setR(reaction);
            setN(note);
            setConfirmDel(false);
          }}
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

      {/* 刪除要按兩下 —— 帶看紀錄刪掉就回不來，熱度與落差分析都會跟著變 */}
      <div style={{ marginTop: 8 }}>
        {confirmDel ? (
          <span style={{ fontSize: FS(11.5), color: CHIP.danger.color }}>
            這筆刪掉就回不來了，熱度分數也會跟著變。{" "}
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              style={{
                border: "none",
                background: "transparent",
                color: CHIP.danger.color,
                fontWeight: 700,
                fontSize: FS(11.5),
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              確定刪除
            </button>
            {" · "}
            <button
              type="button"
              onClick={() => setConfirmDel(false)}
              style={{
                border: "none",
                background: "transparent",
                color: CIS.textMute,
                fontSize: FS(11.5),
                cursor: "pointer",
              }}
            >
              算了
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            style={{
              border: "none",
              background: "transparent",
              color: CIS.textMute,
              fontSize: FS(10.5),
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            記錯類型？刪掉這筆
          </button>
        )}
      </div>

      {err && <p style={{ margin: "7px 0 0", fontSize: FS(11.5), color: CHIP.danger.color }}>⚠️ {err}</p>}
    </div>
  );
}
