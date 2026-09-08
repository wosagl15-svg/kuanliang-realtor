/**
 * 後台 CIS 設計 token
 *
 * 2026-08-20 系統擁有者指定：**Freedom Gundam 配色（白底）＋字級再放大**
 *
 * ⚠️ 先前做成「深色底＋大面積黃」是抓錯方向。Freedom 的識別是：
 *      白色佔絕大面積（機身裝甲）→ 底色與卡片
 *      深藍／亮藍是塊面（翅膀、肩甲）→ 主強調、按鈕、連結
 *      紅只是點綴（胸口進氣口）→ 警示，面積要小
 *      黃只有 V 字天線那一小塊 → 重點標記，面積要更小
 *    黃色一旦大面積使用就不像鋼彈，像金色招牌。
 *
 * ⚠️ token 名稱沿用舊的 blue / blueSoft / yellow（全後台幾十個檔在引用，改名等於全部要動）。
 *    這次名字終於跟顏色對得上了：blue 真的是藍色。
 *
 * ⚠️ 改配色只改這一個檔，不要在頁面裡寫死色碼。
 */

/**
 * 字級總開關 —— 全站要放大縮小只改這一個數字，其他檔都不用動。
 * 頁面裡一律寫 `fontSize: FS(13)`，13 是原始設計值，加多少由這裡決定。
 */
export const FONT_BUMP = 4;
export const FS = (n: number) => n + FONT_BUMP;

export const CIS = {
  bg: "#eaeef5", // 淺灰藍底（襯托白色卡片，純白底會分不出層次）
  bgSoft: "#f5f7fb",
  card: "#ffffff", // 裝甲白
  cardHover: "#f2f6fd",
  cardBorder: "#d3dae7",
  divider: "#e3e8f1",
  text: "#16203a", // 深藍黑，不用純黑
  textSub: "#46536e",
  textMute: "#6f7c96",
  blue: "#1e5bc6", // 鋼彈藍 —— 主強調，按鈕底色配白字
  blueDeep: "#123f96", // 深藍（翅膀）
  blueSoft: "#1750b5", // 白底上的連結字（要夠深才讀得清楚）
  yellow: "#f5c518", // V 字天線黃 —— 只用在小面積重點
  red: "#d9333f", // 胸口紅 —— 點綴用
  /** 按鈕在 blue 底上的字色 */
  onAccent: "#ffffff",
  /** 卡片內的次級區塊底（取代深色版的 rgba 白） */
  panel: "#f5f8fd",
  panelBorder: "#dfe6f2",
  font: "'Noto Sans TC','PingFang TC','Microsoft JhengHei',-apple-system,sans-serif",
  radius: 14,
  radiusSm: 10,
} as const;

// 狀態 chip（白底版，底色要淡、文字要深，才看得清楚）
export const CHIP = {
  success: { bg: "#e6f7ee", color: "#0f7a45", border: "#a6dcc0" },
  warn: { bg: "#fff6dc", color: "#8a6100", border: "#efd287" }, // V字黃
  danger: { bg: "#fdeaec", color: "#b3202e", border: "#f0b2b9" }, // 胸口紅
  info: { bg: "#e8effc", color: "#17458f", border: "#b2c8ee" }, // 鋼彈藍
  neutral: { bg: "#eff2f7", color: "#59657d", border: "#d3dae7" },
} as const;

export type ChipTone = keyof typeof CHIP;

export const cisCard: React.CSSProperties = {
  background: CIS.card,
  border: `1px solid ${CIS.cardBorder}`,
  borderRadius: CIS.radius,
};

export const cisSectionTitle: React.CSSProperties = {
  fontSize: FS(11),
  fontWeight: 700,
  color: CIS.textMute,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 10,
};

/**
 * 鋼彈識別條：深藍 → 亮藍 → 紅 → 黃，比例照機身
 * （藍佔大半、紅一小段、黃最短，就是 V 字天線那個比例）
 */
export const GUNDAM = {
  navy: "#123f96",
  blue: "#1e5bc6",
  red: "#d9333f",
  yellow: "#f5c518",
  white: "#ffffff",
} as const;

export const cisGundamBar: React.CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: `linear-gradient(90deg, ${GUNDAM.navy} 0%, ${GUNDAM.navy} 40%, ${GUNDAM.blue} 40%, ${GUNDAM.blue} 76%, ${GUNDAM.red} 76%, ${GUNDAM.red} 90%, ${GUNDAM.yellow} 90%, ${GUNDAM.yellow} 100%)`,
};
