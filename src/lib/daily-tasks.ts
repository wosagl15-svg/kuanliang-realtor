/**
 * 房仲每日固定工作清單（2026-08-22）
 *
 * 為什麼要有這張表：
 *   預約系統只管得到「已經約好的人」。真正決定這個月有沒有成交的，
 *   是那些沒人會提醒你、也不會有人來催的事 ——
 *   昨天進來的名單有沒有在 24 小時內打第一通、委託中的屋主這週有沒有被回報、
 *   商圈有沒有人去巡。這些漏掉不會馬上痛，會在兩個月後變成「怎麼都沒案子」。
 *
 * 內容依台灣房仲實務日常整理（開發／經營／帶看／回報／日報表五件事），
 * 排成一天的時間軸，讓它變成「照著跑」而不是「想到才做」。
 *
 * ⚠️ 這裡只放「每天都要做」的固定動作。一次性的事情屬於預約案件，
 *    不要往這張表塞，否則清單會長到沒人想勾。
 */

export type DailyTaskBlock = {
  key: string;
  label: string;
  time: string;
  emoji: string;
  /** 這個時段的主軸，一句話 */
  theme: string;
};

export type DailyTask = {
  id: string;
  block: string;
  title: string;
  /** 工作提示：為什麼要做、做到什麼程度才算數 */
  hint: string;
  /** 建議目標數字，沒有就留空 */
  target?: string;
  /** 點了會跳去哪（後台頁或外部工具） */
  href?: string;
  /** 星期幾才出現（0=日）。沒填 = 每天都要做 */
  weekdays?: number[];
};

export const DAILY_BLOCKS: DailyTaskBlock[] = [
  { key: "open", label: "開盤", time: "08:30–10:00", emoji: "🌅", theme: "把昨天沒收的尾巴收乾淨，今天才不會被追著跑" },
  { key: "develop", label: "開發", time: "10:00–12:00", emoji: "🔍", theme: "沒有新案源，後面所有努力都是在分同一塊餅" },
  { key: "nurture", label: "經營", time: "12:00–14:00", emoji: "📣", theme: "屋主要的不是好消息，是知道你有在做事" },
  { key: "field", label: "帶看與拜訪", time: "14:00–18:00", emoji: "🚗", theme: "今天出門見了幾個人，決定下個月有幾個案子" },
  { key: "close", label: "推成交", time: "18:00–20:00", emoji: "🤝", theme: "把卡住的案子往前推一格，比開發十個新客有用" },
  { key: "wrap", label: "收工", time: "20:00–21:00", emoji: "📝", theme: "今天沒寫下來的，等於沒發生過" },
];

export const DAILY_TASKS: DailyTask[] = [
  // ── 開盤 ──────────────────────────────────────────
  {
    id: "open-agenda",
    block: "open",
    title: "看過今天每一場約：時間、地點、路線",
    hint: "提前 15 分鐘到現場。遲到一次，專業感就補不回來了。",
    href: "/admin/today#today-appointments",
  },
  {
    id: "open-newlead",
    block: "open",
    title: "昨天進來的名單，全部打完第一通",
    hint: "超過 24 小時才聯絡，接通率與見面率會直接砍半——這是整天最貴的一件事。",
    href: "/admin/appointments?queue=overdue_contact",
  },
  {
    id: "open-inbox",
    block: "open",
    title: "官網表單／來電／LINE／FB 私訊全部回完",
    hint: "回覆本身就是服務。客戶同時問了三家，誰先回誰拿到見面機會。",
  },
  {
    id: "open-market",
    block: "open",
    title: "掃一次 591／實價登錄新上架與新成交",
    hint: "看新上架找屋主自售，看新成交校正自己手上的開價。每天十分鐘，行情感就是這樣養出來的。",
    href: "https://lvr.land.moi.gov.tw/",
  },

  // ── 開發 ──────────────────────────────────────────
  {
    id: "dev-calls",
    block: "develop",
    title: "開發電訪",
    hint: "自售、租轉售、委託到期、舊客轉介，四種名單輪著打。被掛不算失敗，沒打才算。",
    target: "20 通",
  },
  {
    id: "dev-patrol",
    block: "develop",
    title: "巡商圈：自售紅單、爆掉的信箱、長期空屋",
    hint: "騎一趟固定路線。看到就當下拍照記下來，回辦公室才想「剛剛那間在哪」就沒了。",
  },
  {
    id: "dev-expiring",
    block: "develop",
    title: "委託到期前 7 天的屋主，先打預告電話",
    hint: "到期當天才打就是搶約；提前七天打是續約。差在你有沒有先講「這段時間我做了什麼」。",
    href: "/admin/sellers?stage=listed",
  },
  {
    id: "dev-owner-followup",
    block: "develop",
    title: "追一個曾經談過、但沒簽下來的屋主",
    hint: "沒簽通常不是不賣，是當時價格沒到或家人沒點頭。每天回頭追一個，一個月就是二十次機會。",
    href: "/admin/sellers?stage=lead",
  },

  // ── 經營 ──────────────────────────────────────────
  {
    id: "nur-owner-report",
    block: "nurture",
    title: "屋主回報：每個委託案本週至少兩次",
    hint: "講「這週幾組看、他們嫌什麼、我建議怎麼調」。只說「還在努力」的回報，等於沒回報。系統會自動幫你算出那些數字。",
    href: "/admin/sellers?due=1",
  },
  {
    id: "nur-refresh",
    block: "nurture",
    title: "物件上架刷新：換標題、補照片、調排序",
    hint: "網路平台按更新時間排。一週不動，你的物件就沉到第五頁去了。",
    href: "/admin/listings",
  },
  {
    id: "nur-social",
    block: "nurture",
    title: "發一則社群：區域行情／成交回顧／看屋提醒",
    hint: "不要發「我在賣房」，要發「這區發生什麼事」。客戶是先信任你這個人，才會找你賣房。",
  },
  {
    id: "nur-buyer-match",
    block: "nurture",
    title: "新案子跑一次買方配對，配到就當天推出去",
    hint: "手上的買方資料庫是資產，但只有被拿出來比對的時候才是。",
    href: "/admin/buyers",
  },

  // ── 帶看與拜訪 ─────────────────────────────────────
  {
    id: "field-prep",
    block: "field",
    title: "帶看前備齊：不動產說明書、謄本、比價表",
    hint: "現場被問到答不出來，客戶記住的不是那個問題，是你不專業。",
  },
  {
    id: "field-visit",
    block: "field",
    title: "實體拜訪：管理室、店家、老客戶",
    hint: "面對面十分鐘，勝過電話十通。管理室尤其重要——社區在賣什麼，他們最早知道。",
    target: "3 個點",
    href: "/admin/today#today-visits",
  },
  {
    id: "field-feedback",
    block: "field",
    title: "帶看後兩小時內，把買方的話整理好回報屋主",
    hint: "「三組都說採光不好」是屋主降價的理由；隔一天再講就變成推託。帶看紀錄記進買方，回報表會自動撈出來。",
    href: "/admin/sellers?due=1",
  },
  {
    id: "field-new-contact",
    block: "field",
    title: "今天至少交換到一組新聯絡方式",
    hint: "帶看的鄰居、管理員、對面店家都算。沒有新名單的一天，就是在吃老本。",
    target: "1 組",
  },

  // ── 推成交 ────────────────────────────────────────
  {
    id: "close-a-list",
    block: "close",
    title: "A 級客戶（一個月內會買）今天全部聯絡過",
    hint: "A 級每天、B 級三天、C 級每週。分級不做，時間就會全花在最愛聊天的那個人身上。",
  },
  {
    id: "close-stuck",
    block: "close",
    title: "挑一個卡住的案子，找出到底卡在哪",
    hint: "價格、屋況、貸款、家人不同意——一次只解一個。四個一起講，客戶只會全部說再想想。",
    href: "/admin/appointments?queue=followup_due",
  },
  {
    id: "close-offer",
    block: "close",
    title: "有斡旋／要約的案子，今天一定要往前推一步",
    hint: "斡旋放著就是在冷掉。今天沒有進度，也要讓雙方知道你今天做了什麼。",
    href: "/admin/sellers?stage=negotiating",
  },
  {
    id: "close-outcome",
    block: "close",
    title: "今天見過面的客戶，當場填結果與下一步",
    hint: "熱度、要做什麼、什麼時候再聯絡。晚上再回想，細節已經掉了七成。",
    href: "/admin/appointments?queue=outcome_pending",
  },

  // ── 收工 ──────────────────────────────────────────
  {
    id: "wrap-daily-report",
    block: "wrap",
    title: "填日報：今天接觸了誰、談到哪、明天要做什麼",
    hint: "日報不是寫給主管看的，是寫給下週的自己看的。",
  },
  {
    id: "wrap-promise",
    block: "wrap",
    title: "今天口頭答應客戶的事，全部寫進系統",
    hint: "「我幫你問問看」也是承諾。忘記一次，前面三個月的信任一起賠掉。屋主那邊記進聯絡歷程，下次翻得到。",
    href: "/admin/sellers",
  },
  {
    id: "wrap-tomorrow",
    block: "wrap",
    title: "排明天：三場約 ＋ 一條拜訪路線 ＋ 第一通電話打給誰",
    hint: "明天早上才想「今天要做什麼」，一整個上午就沒了。",
  },
  {
    id: "wrap-weekly",
    block: "wrap",
    title: "週檢討：這週幾通、幾組看、幾件委託、幾件成交",
    hint: "數字難看不可怕，不知道自己數字才可怕。找出漏掉最多人的那一關。",
    weekdays: [5, 6],
  },
];

/** 今天（週幾）該出現的工作。weekdays 沒填的每天都算。 */
export function tasksForWeekday(weekday: number): DailyTask[] {
  return DAILY_TASKS.filter((t) => !t.weekdays || t.weekdays.includes(weekday));
}

/** 台灣時區的 YYYY-MM-DD，勾選進度以這個字串分天存 */
export function taipeiDateKey(now: Date = new Date()): string {
  const tw = new Date(now.getTime() + 8 * 60 * 60_000);
  return `${tw.getUTCFullYear()}-${String(tw.getUTCMonth() + 1).padStart(2, "0")}-${String(tw.getUTCDate()).padStart(2, "0")}`;
}

/** 台灣時區的星期幾（0=日） */
export function taipeiWeekday(now: Date = new Date()): number {
  return new Date(now.getTime() + 8 * 60 * 60_000).getUTCDay();
}
