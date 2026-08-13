/**
 * 買方需求「規則解析」——不需要任何 API 金鑰（2026-08-13）
 *
 * 為什麼要有這支：
 *   原本建檔唯一入口是 AI 解析，沒設 ANTHROPIC_API_KEY 就一筆買方都建不了，
 *   等於整套系統被一把鑰匙鎖死。這支用純規則（正則＋關鍵字）抓出台灣房仲
 *   對話裡最常出現的欄位，讓系統零成本、零設定就能用。
 *
 * 定位：AI 是升級，不是前提。
 *   有金鑰 → 用 AI（懂上下文、抓得到「太太決定」「要先賣掉現在的房子」這種）
 *   沒金鑰 → 用規則（抓得到數字與關鍵字，抓不到的老實留白）
 *
 * 🔴 一樣守三條鐵律：不編造、標信心度、人工確認才入庫。
 *    規則解析的信心度一律不高於 medium —— 它沒有理解，只是在比對字串。
 */
import { DISTRICTS, SEED_TAGS } from "@/lib/buyer-constants";
import { extractPhones } from "@/lib/phone";
import type { ExtractedBuyer } from "@/lib/buyer-extract";

// ---- 中文數字 ----
const CN_DIGIT: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 「一千兩百」→1200、「八百」→800、「兩千」→2000、「三」→3 */
function cnToNumber(s: string): number | null {
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);

  let total = 0;
  let section = 0;
  let last = 0;
  for (const ch of s) {
    if (ch in CN_DIGIT) {
      last = CN_DIGIT[ch];
      section = last;
    } else if (ch === "十") {
      section = (last || 1) * 10;
      total += section;
      section = 0;
      last = 0;
    } else if (ch === "百") {
      total += (last || 1) * 100;
      section = 0;
      last = 0;
    } else if (ch === "千") {
      total += (last || 1) * 1000;
      section = 0;
      last = 0;
    } else {
      return null; // 出現看不懂的字就放棄，不硬猜
    }
  }
  total += section;
  return total > 0 ? total : null;
}

/** 把一段可能是數字或中文數字的字串轉成數值 */
function toNum(raw: string): number | null {
  const cleaned = raw.replace(/[,，\s]/g, "");
  if (/^\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  return cnToNumber(cleaned);
}

type Note = { field: string; level: "high" | "medium" | "low"; evidence: string | null };

/** 抓出這句話所在的整句，當作原文出處 */
function sentenceOf(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf("\n", index), text.lastIndexOf("。", index) + 1);
  let end = text.length;
  for (const p of ["\n", "。", "！", "？"]) {
    const i = text.indexOf(p, index);
    if (i !== -1 && i < end) end = i;
  }
  return text.slice(start, end).trim().slice(0, 80);
}

// ---- 預算 ----
function parseBudget(text: string): {
  min: number | null;
  max: number | null;
  raw: string | null;
  evidence: string | null;
  fuzzy: boolean;
} {
  // 區間：1200~1500萬 / 800-1200萬 / 一千到一千五百萬
  const range = text.match(
    /([\d,.]+|[零一二兩三四五六七八九十百千]+)\s*[-~～到至]\s*([\d,.]+|[零一二兩三四五六七八九十百千]+)\s*(?:萬|萬元)/,
  );
  if (range) {
    const a = toNum(range[1]);
    const b = toNum(range[2]);
    if (a !== null && b !== null) {
      return {
        min: Math.min(a, b),
        max: Math.max(a, b),
        raw: range[0],
        evidence: sentenceOf(text, range.index ?? 0),
        fuzzy: false,
      };
    }
  }

  // 上限：2000萬以內 / 不超過1500萬 / 最多1200萬
  const cap = text.match(
    /(?:預算|總價)?\s*(?:最多|不超過|不要超過|以內|以下|上限)?\s*([\d,.]+|[零一二兩三四五六七八九十百千]+)\s*(?:萬|萬元)\s*(?:以內|以下|左右|上下|出頭|內)?/,
  );
  if (cap) {
    const v = toNum(cap[1]);
    if (v !== null && v >= 50 && v <= 50_000) {
      // 「左右」「上下」「大概」「差不多」都算模糊表述
      const ctx = sentenceOf(text, cap.index ?? 0);
      const fuzzy = /左右|上下|大概|大約|差不多|看情況|再說|應該/.test(ctx);
      return { min: null, max: v, raw: cap[0].trim(), evidence: ctx, fuzzy };
    }
  }

  return { min: null, max: null, raw: null, evidence: null, fuzzy: false };
}

// ---- 房數 ----
function parseRooms(text: string): { rooms: number | null; evidence: string | null } {
  const m = text.match(/([\d]|[一二兩三四五六七八九])\s*(?:\+\s*\d\s*)?房/);
  if (!m) return { rooms: null, evidence: null };
  const n = toNum(m[1]);
  if (n === null || n < 1 || n > 10) return { rooms: null, evidence: null };
  return { rooms: n, evidence: sentenceOf(text, m.index ?? 0) };
}

// ---- 主解析 ----
export function parseBuyerByRules(text: string): ExtractedBuyer {
  const confidence: Note[] = [];
  const unclear: string[] = [];
  const push = (field: string, level: Note["level"], evidence: string | null) =>
    confidence.push({ field, level, evidence });

  // 電話
  const phones = extractPhones(text);
  const phone = phones[0] ?? null;
  if (phone) push("phone", "high", null);

  // 姓名：抓「X先生」「X小姐」「X太太」「X大哥」
  let name: string | null = null;
  const nameM = text.match(/([一-龥]{1,3})\s*(先生|小姐|太太|大哥|大姊|姐|阿姨|老師)/);
  if (nameM) {
    name = nameM[0].replace(/\s/g, "");
    push("name", "medium", sentenceOf(text, nameM.index ?? 0));
  }

  // 區域
  const districts: string[] = [];
  for (const d of DISTRICTS) {
    if (d.key === "other") continue;
    const short = d.label.replace(/區$/, "");
    const i = text.indexOf(short);
    if (i !== -1) {
      districts.push(d.key);
      if (districts.length === 1) push("districts", "high", sentenceOf(text, i));
    }
  }
  if (!districts.length) unclear.push("請問您主要想找哪幾個區域？");

  // 預算
  const b = parseBudget(text);
  if (b.max !== null) {
    push("budget_max", b.fuzzy ? "medium" : "high", b.evidence);
    if (b.min !== null) push("budget_min", "high", b.evidence);
  } else {
    unclear.push("請問您的總價預算上限大概到多少？");
  }

  // 房數
  const r = parseRooms(text);
  if (r.rooms !== null) push("room_min", "high", r.evidence);
  else unclear.push("請問您需要幾房？");

  // 電梯
  let elevator: ExtractedBuyer["elevator"] = "any";
  if (/不要電梯|不用電梯|公寓就好|公寓可以/.test(text)) {
    elevator = "exclude";
    push("elevator", "high", null);
  } else if (/要電梯|需要電梯|一定要電梯|電梯大樓|電梯華廈/.test(text)) {
    elevator = "required";
    push("elevator", "high", null);
  } else {
    unclear.push("請問一定要有電梯嗎？");
  }

  // 車位
  let parking: ExtractedBuyer["parking"] = "any";
  if (/不用車位|不需要車位|沒車位也可以|不要車位/.test(text)) {
    parking = "none";
    push("parking", "high", null);
  } else if (/可以加價買車位|車位可加購|加價買車位/.test(text)) {
    parking = "buyable";
    push("parking", "medium", null);
  } else if (/要車位|需要車位|一定要車位|附車位|含車位|平面車位|機械車位/.test(text)) {
    parking = "required";
    push("parking", "high", null);
  } else {
    unclear.push("請問需要車位嗎？幾個？");
  }

  // 用途
  let purpose: ExtractedBuyer["purpose"] = "unknown";
  if (/自住|自己住|要住的|結婚|新家/.test(text)) {
    purpose = "self";
    push("purpose", "medium", null);
  } else if (/投資|收租|出租|報酬率|轉手/.test(text)) {
    purpose = "invest";
    push("purpose", "medium", null);
  } else if (/置產|長期持有|保值/.test(text)) {
    purpose = "asset";
    push("purpose", "medium", null);
  }

  // 坪數
  let sizeMin: number | null = null;
  let sizeMax: number | null = null;
  const sizeRange = text.match(/([\d.]+)\s*[-~～到至]\s*([\d.]+)\s*坪/);
  const sizeOne = text.match(/([\d.]+)\s*坪\s*(以上|以內|左右)?/);
  if (sizeRange) {
    sizeMin = Number(sizeRange[1]);
    sizeMax = Number(sizeRange[2]);
    push("size_min", "high", sentenceOf(text, sizeRange.index ?? 0));
  } else if (sizeOne) {
    const v = Number(sizeOne[1]);
    if (v > 0 && v <= 500) {
      if (sizeOne[2] === "以內") sizeMax = v;
      else sizeMin = v;
      push("size_min", "medium", sentenceOf(text, sizeOne.index ?? 0));
    }
  }

  // 屋齡
  let ageMax: number | null = null;
  const ageM = text.match(/(?:屋齡|房齡)?\s*([\d]{1,2}|[一二兩三四五六七八九十]+)\s*年\s*(?:以內|內|以下)/);
  if (ageM) {
    const v = toNum(ageM[1]);
    if (v !== null && v <= 100) {
      ageMax = v;
      push("age_max", "high", sentenceOf(text, ageM.index ?? 0));
    }
  } else if (/新成屋|全新|新古屋|預售/.test(text)) {
    ageMax = 5;
    push("age_max", "low", null);
  }

  // 樓層偏好
  let floorPref: string | null = null;
  const floorM = text.match(/(不要一樓|不要頂樓|不要四樓|中高樓層|高樓層|低樓層|要一樓|樓層不拘)/);
  if (floorM) {
    floorPref = floorM[1];
    push("floor_pref", "high", sentenceOf(text, floorM.index ?? 0));
  }

  // 標籤：直接比對受控標籤清單
  const tags: string[] = [];
  const avoid: string[] = [];
  for (const t of SEED_TAGS) {
    const core = t.name.replace(/^近|^不要|^避/, "");
    if (core.length >= 2 && text.includes(core)) {
      if (t.category === "avoid") avoid.push(t.name);
      else tags.push(t.name);
    }
  }

  // 急迫度
  let urgency: ExtractedBuyer["urgency"] = "unknown";
  if (/很急|越快越好|盡快|這個月|馬上|急著/.test(text)) urgency = "asap";
  else if (/一兩個月|三個月內|年底前|過年前/.test(text)) urgency = "soon";
  else if (/先看看|不急|再說|了解一下|參考/.test(text)) urgency = "explore";
  if (urgency !== "unknown") push("urgency", "medium", null);

  // 決策人
  let decisionMaker: string | null = null;
  // 中間允許「一起」「跟我」「也要」等插入語 ——
  // 實測「太太一起決定」原本抓不到，因為要求兩個詞相連。
  const dm = text.match(
    /(太太|老婆|先生|老公|爸媽|父母|家人|婆婆|媽媽|爸爸|長輩)[^\n。，,]{0,6}(決定|說了算|同意|點頭|一起看|要看過|拍板)/,
  );
  if (dm) {
    decisionMaker = dm[0];
    push("decision_maker", "medium", sentenceOf(text, dm.index ?? 0));
  } else {
    unclear.push("請問這次買房主要是誰做決定？");
  }

  // 資金
  let fundingNote: string | null = null;
  const fund = text.match(/[^\n。]*(?:貸款|自備|頭期|現金|房貸|成數|先賣)[^\n。]*/);
  if (fund) {
    fundingNote = fund[0].trim().slice(0, 100);
    push("funding_note", "medium", fundingNote);
  } else {
    unclear.push("請問資金規劃上，自備款和貸款成數大概怎麼安排？");
  }

  // 社區名稱：抓「XX社區」「XX大樓」「XX名邸」等
  const communityNames: string[] = [];
  for (const m of text.matchAll(/([一-龥]{2,8})(社區|大樓|大苑|名邸|花園|別墅|華廈|國宅)/g)) {
    const n = m[0];
    if (!communityNames.includes(n)) communityNames.push(n);
  }

  // 地標
  const landmarks: string[] = [];
  for (const lm of ["高鐵", "火車站", "Costco", "好市多", "交流道", "夜市", "市場", "公園", "醫院", "科大", "國小", "國中"]) {
    if (text.includes(lm)) landmarks.push(lm);
  }

  const summary = [
    name ?? "這位客戶",
    districts.length ? `想找${districts.map((k) => DISTRICTS.find((d) => d.key === k)?.label).join("、")}` : "區域未提",
    b.max ? `預算約 ${b.min ? `${b.min}–` : ""}${b.max} 萬` : "預算未提",
    r.rooms ? `${r.rooms} 房以上` : "",
    parking === "required" ? "需車位" : "",
  ]
    .filter(Boolean)
    .join("，");

  return {
    name,
    phone,
    line_id: null,
    budget_min: b.min,
    budget_max: b.max,
    budget_raw: b.fuzzy ? b.raw : null,
    districts: districts as ExtractedBuyer["districts"],
    community_names: communityNames.slice(0, 5),
    landmarks: landmarks.slice(0, 8),
    room_min: r.rooms,
    elevator,
    parking,
    purpose,
    size_min: sizeMin,
    size_max: sizeMax,
    age_max: ageMax,
    floor_pref: floorPref,
    tags: [...new Set(tags)].slice(0, 15),
    avoid: [...new Set(avoid)].slice(0, 10),
    decision_maker: decisionMaker,
    funding_note: fundingNote,
    urgency,
    personality_note: null,
    viewing_plan: null,
    confidence,
    unclear,
    summary: summary + "。（規則解析，建議逐欄確認）",
  };
}
