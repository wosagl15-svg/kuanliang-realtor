"use client";

/**
 * 一鍵複製追蹤連結（2026-08-22）
 *
 * 客戶自助改約／取消的連結是一長串帶簽章的 token，用選取拖曳的方式複製
 * 十次有三次會少一個字元，貼給客戶就變成打不開——所以一定要有這顆按鈕。
 */

import { useState } from "react";
import { CIS, FS } from "@/app/admin/_components/cis";

export default function CopyLink({
  value,
  label,
  title,
}: {
  value: string;
  label: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // 舊瀏覽器／非 https 沒有 clipboard API，退回 textarea + execCommand
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title || value}
      style={{
        fontSize: FS(11),
        fontWeight: 700,
        padding: "5px 11px",
        borderRadius: 999,
        cursor: "pointer",
        border: `1px solid ${copied ? "#a6dcc0" : CIS.cardBorder}`,
        background: copied ? "#e6f7ee" : CIS.card,
        color: copied ? "#0f7a45" : CIS.textSub,
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ 已複製" : label}
    </button>
  );
}
