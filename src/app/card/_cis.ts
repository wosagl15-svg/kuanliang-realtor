/**
 * 海線房仲冠良 CIS — 前台版（/card 名片頁 / 預約表單 / 成功頁，給客戶看）
 * 2026-08-12：改為品牌配色 深藍 #16283f + 金 #c8963e + 米 #f7f3ea，與官網 kuanhome 一致。
 * ⚠️ 跟後台深色 cis.ts 分開（那是給系統擁有者久盯的深色；這是給客戶的名片）。
 */
export const RCIS = {
  sky: "#16283f", // 深藍（主色）
  skyDeep: "#0f1d2e", // 更深藍（hover / 強調）
  skySoft: "#efe8da", // 淺米底
  orange: "#c8963e", // 金（CTA / 強調）
  orangeDeep: "#b8862e",
  orangeSoft: "#f3e6cc",
  ink: "#2b2b2b", // 深字（主文字）
  inkSoft: "#4a5560", // 次深字
  muted: "#6f6a60", // 弱字
  bg: "#FFFFFF",
  bgSoft: "#f7f3ea", // 米色頁底
  border: "#ddd2bd",
  line: "#e8e0d0",
  green: "#2BB673", // 成功 / 確認
  font: "'Noto Sans TC','PingFang TC','Microsoft JhengHei',-apple-system,BlinkMacSystemFont,sans-serif",
  radius: 16,
  radiusSm: 10,
  shadow: "0 4px 20px rgba(22,40,63,0.08)",
  shadowLg: "0 12px 44px rgba(22,40,63,0.16)",
} as const;

// 業績溫度色（後台 + 通知共用判讀）
export const HEAT_TONE: Record<string, { label: string; emoji: string; color: string }> = {
  high: { label: "高溫", emoji: "🔥", color: "#c8963e" },
  mid: { label: "中溫", emoji: "🟡", color: "#1f3752" },
  low: { label: "低溫", emoji: "⚪", color: "#6f6a60" },
};
