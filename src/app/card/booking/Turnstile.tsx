"use client";

/**
 * Cloudflare Turnstile 防機器人小工具（2026-08-12 補上）
 *
 * 🔴 為什麼要有這個檔：
 *    後端 verifyAppointmentTurnstile() 的規則是——
 *      沒設 TURNSTILE_SECRET_KEY  → 放行
 *      設了但前端沒送 token       → 一律擋下
 *    所以少了這個元件，金鑰一填上去，所有預約都會被拒絕。
 *
 * 沒設 NEXT_PUBLIC_TURNSTILE_SITE_KEY 時，本元件什麼都不畫（也不會擋人），
 * 讓「還沒申請金鑰」的狀態照常運作。
 */

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.turnstile) return resolve();
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
}

export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

export default function Turnstile({
  onToken,
}: {
  /** 拿到（或失去）驗證 token 時回呼；過期／失敗時會傳空字串 */
  onToken: (token: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  // 用 ref 存 callback，避免父層每次 render 都重新掛載小工具
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return;
        if (widgetId.current) return; // 已經掛過就不重複掛
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: SITE_KEY,
          language: "zh-TW",
          callback: (token: string) => cb.current(token),
          "expired-callback": () => cb.current(""),
          "error-callback": () => cb.current(""),
        });
      })
      .catch(() => {
        // 載不到 Cloudflare 就不擋人：後端仍會依 token 有無做判斷
        cb.current("");
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* 忽略：元件已被卸載 */
        }
        widgetId.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={boxRef} style={{ marginTop: 14 }} />;
}
