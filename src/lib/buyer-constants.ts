/**
 * 買方資料庫 — 純常數 / 規則 / 型別（2026-08-12）
 * ⚠️ 不 import db / 任何 server-only 模組，client + server 都可安全 import（篩選面板需要 DISTRICTS 等）。
 *
 * 設計原則（系統擁有者拍板 2026-08-12）：
 *   硬條件 = 不符直接排除；軟條件 = 只影響排序分數。兩者分開存，配對才不會推出一堆讓客戶覺得不專業的物件。
 */

// ---- 服務區域（台中海線為主，必要時延伸市區）----
export const DISTRICTS = [
  { key: "shalu", label: "沙鹿區", core: true },
  { key: "qingshui", label: "清水區", core: true },
  { key: "wuqi", label: "梧棲區", core: true },
  { key: "longjing", label: "龍井區", core: true },
  { key: "dadu", label: "大肚區", core: true },
  { key: "daan", label: "大安區", core: true },
  { key: "dajia", label: "大甲區", core: true },
  { key: "waipu", label: "外埔區", core: false },
  { key: "houli", label: "后里區", core: false },
  { key: "shengang", label: "神岡區", core: false },
  { key: "xitun", label: "西屯區", core: false },
  { key: "beitun", label: "北屯區", core: false },
  { key: "nantun", label: "南屯區", core: false },
  { key: "other", label: "其他", core: false },
] as const;

export type DistrictKey = (typeof DISTRICTS)[number]["key"];

/** 核心服務區優先顯示（篩選面板第一排） */
export const CORE_DISTRICTS = DISTRICTS.filter((d) => d.core);

export function districtLabel(key: string): string {
  return DISTRICTS.find((d) => d.key === key)?.label ?? key;
}

// ---- 硬條件選項（不符直接排除）----

export const ELEVATOR_OPTIONS = [
  { key: "any", label: "無所謂" },
  { key: "required", label: "一定要電梯" },
  { key: "exclude", label: "不要電梯（公寓即可）" },
] as const;

export const PARKING_OPTIONS = [
  { key: "any", label: "無所謂" },
  { key: "required", label: "一定要車位" },
  { key: "buyable", label: "可加價買車位" },
  { key: "none", label: "不需要車位" },
] as const;

export const PURPOSE_OPTIONS = [
  { key: "self", label: "自住", emoji: "🏠" },
  { key: "invest", label: "投資（收租／轉手）", emoji: "📈" },
  { key: "asset", label: "置產（長期持有）", emoji: "🏦" },
  { key: "unknown", label: "還沒確定", emoji: "❓" },
] as const;

/** 房數下限。0 = 不限 */
export const ROOM_OPTIONS = [
  { key: 0, label: "不限" },
  { key: 1, label: "1 房以上" },
  { key: 2, label: "2 房以上" },
  { key: 3, label: "3 房以上" },
  { key: 4, label: "4 房以上" },
] as const;

/** 物件類型。第一版只實作 house，其餘留位置（土地欄位與住宅幾乎不重疊，硬塞同一張表兩邊都難用） */
export const PROPERTY_TYPES = [
  { key: "house", label: "住宅", enabled: true },
  { key: "land", label: "土地", enabled: false },
  { key: "shop", label: "店面／辦公", enabled: false },
  { key: "factory", label: "廠房", enabled: false },
] as const;

export type PropertyTypeKey = (typeof PROPERTY_TYPES)[number]["key"];

// ---- 客戶階段（決定明天早上先打給誰）----
export const STAGES = [
  { key: "new", label: "剛問問", tone: "neutral", order: 1 },
  { key: "active", label: "積極看屋", tone: "success", order: 2 },
  { key: "offering", label: "已出價／斡旋", tone: "warn", order: 3 },
  { key: "closed", label: "已成交", tone: "info", order: 4 },
  { key: "cold", label: "冷掉", tone: "neutral", order: 5 },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export function stageLabel(key: string): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

// ---- 資料來源 ----
export const SOURCES = [
  { key: "line", label: "LINE 對話" },
  { key: "transcript", label: "錄音逐字稿" },
  { key: "web_form", label: "官網自由描述" },
  { key: "booking", label: "線上預約轉入" },
  { key: "manual", label: "手動建檔" },
  { key: "referral", label: "轉介紹" },
  { key: "onsite", label: "現場帶看" },
] as const;

export function sourceLabel(key: string): string {
  return SOURCES.find((s) => s.key === key)?.label ?? key;
}

// ---- 互動紀錄類型 ----
export const CONTACT_TYPES = [
  { key: "call", label: "通話", emoji: "📞" },
  { key: "line", label: "LINE", emoji: "💬" },
  { key: "meet", label: "面談", emoji: "🤝" },
  { key: "viewing", label: "帶看", emoji: "🔑" },
  { key: "pitch", label: "推案", emoji: "📤" },
  { key: "note", label: "備註", emoji: "📝" },
] as const;

export type ContactTypeKey = (typeof CONTACT_TYPES)[number]["key"];

/** 帶看／推案之後客戶的反應。這是「嘴巴 vs 行為」分析的原料。 */
export const REACTIONS = [
  { key: "loved", label: "很喜歡", tone: "success", weight: 2 },
  { key: "ok", label: "還可以", tone: "info", weight: 1 },
  { key: "meh", label: "沒感覺", tone: "neutral", weight: 0 },
  { key: "disliked", label: "不喜歡", tone: "warn", weight: -1 },
  { key: "offered", label: "出價了", tone: "success", weight: 3 },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

export function reactionLabel(key: string | null | undefined): string {
  if (!key) return "";
  return REACTIONS.find((r) => r.key === key)?.label ?? key;
}

// ---- 標籤分類（受控標籤只能從既有清單選，才不會長出「近捷運／捷運近／離捷運近」三個同義標籤）----
export const TAG_CATEGORIES = [
  { key: "area", label: "區域特色" },
  { key: "layout", label: "房型格局" },
  { key: "transport", label: "交通" },
  { key: "school", label: "學區" },
  { key: "amenity", label: "生活機能" },
  { key: "special", label: "特殊需求" },
  { key: "avoid", label: "避雷項目" },
] as const;

export type TagCategoryKey = (typeof TAG_CATEGORIES)[number]["key"];

/** 首次建表時塞進去的受控標籤種子。之後可在後台新增，但要過審才進受控層。 */
export const SEED_TAGS: Array<{ name: string; category: TagCategoryKey }> = [
  // 交通
  { name: "近高鐵台中站", category: "transport" },
  { name: "近沙鹿火車站", category: "transport" },
  { name: "近清水火車站", category: "transport" },
  { name: "近交流道", category: "transport" },
  { name: "近台灣大道", category: "transport" },
  // 生活機能
  { name: "近Costco", category: "amenity" },
  { name: "近市場", category: "amenity" },
  { name: "近醫院", category: "amenity" },
  { name: "近公園", category: "amenity" },
  { name: "近夜市", category: "amenity" },
  // 房型格局
  { name: "電梯大樓", category: "layout" },
  { name: "華廈", category: "layout" },
  { name: "透天", category: "layout" },
  { name: "公寓", category: "layout" },
  { name: "邊間", category: "layout" },
  { name: "雙衛", category: "layout" },
  { name: "採光佳", category: "layout" },
  { name: "格局方正", category: "layout" },
  // 學區
  { name: "學區宅", category: "school" },
  // 特殊需求
  { name: "新成屋", category: "special" },
  { name: "可寵物", category: "special" },
  { name: "需車位兩個", category: "special" },
  { name: "長輩同住（需無障礙）", category: "special" },
  { name: "首購", category: "special" },
  { name: "換屋", category: "special" },
  // 避雷
  { name: "避嫌惡設施", category: "avoid" },
  { name: "不要頂樓", category: "avoid" },
  { name: "不要一樓", category: "avoid" },
  { name: "不要路沖", category: "avoid" },
  { name: "不要凶宅", category: "avoid" },
  { name: "不要海砂輻射", category: "avoid" },
];

// ---- 完整度計分：欄位權重表 ----
// 系統擁有者拍板：分數只是報告，「缺什麼」才是行動。所以每個欄位都要有中文名稱可以顯示。
export const COMPLETENESS_FIELDS = [
  // 基本聯絡（沒這些等於沒客戶）
  { field: "name", label: "姓名", weight: 8, group: "basic" },
  { field: "phone_norm", label: "電話", weight: 12, group: "basic" },
  // 硬條件（決定配對準不準）
  { field: "budget_max", label: "預算上限", weight: 14, group: "hard" },
  { field: "districts", label: "意向區域", weight: 12, group: "hard" },
  { field: "room_min", label: "最少房數", weight: 8, group: "hard" },
  { field: "parking", label: "車位需求", weight: 6, group: "hard" },
  { field: "elevator", label: "電梯需求", weight: 5, group: "hard" },
  { field: "purpose", label: "購屋用途", weight: 5, group: "hard" },
  // 軟條件（影響排序）
  { field: "size_min", label: "坪數需求", weight: 5, group: "soft" },
  { field: "age_max", label: "屋齡上限", weight: 3, group: "soft" },
  { field: "tags", label: "需求標籤", weight: 6, group: "soft" },
  // 人的資訊（最常漏，但最影響成交）
  { field: "decision_maker", label: "決策人", weight: 6, group: "people" },
  { field: "urgency", label: "急迫度", weight: 5, group: "people" },
  { field: "funding", label: "資金／貸款狀況", weight: 5, group: "people" },
] as const;

export const COMPLETENESS_TOTAL = COMPLETENESS_FIELDS.reduce((s, f) => s + f.weight, 0); // = 100

/** 資訊完整度 → 等級。注意：完整度高 ≠ 意願高，真正的 A 級要兩軸都高（見 heatScore）。 */
export function gradeOf(pct: number): "A" | "B" | "C" | "D" {
  if (pct >= 80) return "A";
  if (pct >= 50) return "B";
  if (pct >= 20) return "C";
  return "D";
}

export const GRADE_TONE: Record<string, "success" | "info" | "warn" | "neutral"> = {
  A: "success",
  B: "info",
  C: "warn",
  D: "neutral",
};

// ---- 需求時效 ----
/** 超過這個天數沒更新需求 → 標「需求待確認」，配對時降權。
 *  理由：三個月前說 1800 萬、上個月改口 2200，只存一個值會讓配對一直用舊需求比對，用兩次就沒人信。 */
export const REQUIREMENT_STALE_DAYS = 90;

/** 超過這個天數沒接觸 → 沉睡名單浮上來。房仲的錢很多是丟在「忘了跟進」上。 */
export const DORMANT_DAYS = 45;

// ---- 推播護欄（避免重蹈群發花錢多、成效差、被封鎖的覆轍）----
export const BROADCAST_RULES = {
  /** 同一買方最短推播間隔（天） */
  minIntervalDays: 7,
  /** 單批次最多幾筆（超過通常代表沒篩乾淨，就是亂撒網） */
  maxTargetsPerBatch: 50,
} as const;

// ---- 型別 ----

export type BuyerRow = {
  id: string;
  name: string;
  phone_norm: string;
  phone_raw: string | null;
  line_user_id: string | null;
  source: string;
  stage: StageKey;
  property_type: PropertyTypeKey;
  owner_email: string | null;
  completeness_pct: number;
  grade: string;
  personality_note: string | null;
  decision_maker: string | null;
  funding_note: string | null;
  urgency: string | null;
  broadcast_opt_out: boolean;
  last_contact_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
};

export type BuyerRequirementRow = {
  id: string;
  buyer_id: string;
  is_current: boolean;
  budget_min: number | null;
  budget_max: number | null;
  budget_flex_pct: number;
  districts: string | null; // JSON string[]
  room_min: number | null;
  elevator: string;
  parking: string;
  purpose: string;
  size_min: number | null;
  size_max: number | null;
  age_max: number | null;
  floor_pref: string | null;
  soft_json: string | null; // JSON 其餘軟條件
  raw_source_text: string | null;
  extraction_meta: string | null; // JSON：逐欄位信心度 + 原文出處
  created_at: Date;
};

/** AI 抽取時每個欄位的信心度。系統擁有者鐵律：寧可留白，不要編一個看起來很精確的假資料。 */
export type FieldConfidence = {
  /** high = 客戶明確講了；medium = 有講但模糊；low = 用推的 */
  level: "high" | "medium" | "low";
  /** 原文出處：這個判斷是根據哪句話 */
  evidence: string | null;
  /** 模糊表述的原話，例：「兩千左右吧看情況」 */
  note?: string | null;
};

export type ExtractionMeta = Record<string, FieldConfidence>;

/**
 * 社區型態 —— 決定「這筆帶看紀錄要顯示什麼名字」。
 *
 * 獨棟透天沒有社區名，逼業務填社區名只會生出「中山路透天」這種假社區，
 * 主檔一旦被污染，之後「輸入社區撈出所有想買的人」就永遠不準。
 */
export const COMMUNITY_KINDS = [
  { key: "building", label: "電梯大樓／華廈", shows: "name", hint: "有正式大樓名稱" },
  { key: "community", label: "社區", shows: "name", hint: "整個社區共用一個名字" },
  { key: "house", label: "獨棟透天／別墅", shows: "address", hint: "沒有社區名，用地址辨識" },
] as const;

export type CommunityKind = (typeof COMMUNITY_KINDS)[number]["key"];

/** 這筆社區在畫面上要顯示什麼：透天顯示地址，其餘顯示名稱 */
export function communityDisplay(c: { name: string; address?: string | null; kind?: string | null }): string {
  if (c.kind === "house" && c.address) return c.address;
  return c.name;
}
