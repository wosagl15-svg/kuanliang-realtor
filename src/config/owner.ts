/**
 * 👤 這個系統是誰的 —— 從這裡改，只改這一個檔
 *
 * 名片頁、預約表單、通知信、日曆邀請 全都讀這裡。
 * 把下面換成你自己的資料，整套系統就是你的了。
 *
 * ⚠️ 這個檔會進 Git。手機與 Email 填進去等於公開在網路上
 *    （名片本來就是要給人看的，但你如果不想被爬蟲收割，
 *      可以改成讀環境變數：process.env.OWNER_PHONE 之類）。
 */

export const OWNER = {
  /** 你的名字（正式全名，出現在通知信署名與日曆邀請） */
  name: "吳冠良",
  /** 慣用稱呼（客戶怎麼叫你，出現在文案裡：「冠良會與您聯繫」） */
  alias: "冠良",
  /** 頭銜 */
  title: "台中海線專業房地產顧問",
  /** 手機（顯示用，含分隔線） */
  phone: "0915-295-958",
  /** 手機（純數字，撥號連結與 LINE 加好友用） */
  phoneRaw: "0915295958",
  /** 聯絡信箱（客戶回信會到這裡） */
  email: "wosagl15@gmail.com",
  /** 公司地址（「公司面談」這個選項會顯示它） */
  address: "台中市海線（沙鹿・清水・梧棲・龍井・大肚・大甲・外埔）",
  /** 公司／品牌名 */
  company: "海線房仲冠良",
  /** 大頭照放 public/card/ 底下 */
  photoUrl: "/card/owner.webp",
  /** 一句話介紹自己 */
  slogan: "深耕台中海線．資產配置／稅務諮詢／簡易裝潢．善願必佑，站在客戶這一邊——懂你又懂房。",
} as const;

/** 社群連結 —— 用不到的留空字串，畫面會自動不顯示 */
export const SOCIAL = {
  line: "https://lin.ee/1WlfBub",
  fb: "https://www.facebook.com/share/14XZ3Wy4nLZ/",
  yt: "https://www.youtube.com/@吳冠良-w9v",
  ig: "https://www.instagram.com/asmile55178/",
} as const;

/** LINE 加好友 QR 圖（放 public/card/ 底下）。null = 不顯示 QR 區 */
export const LINE_QR: string | null = null;

/** 網站網址（通知信裡的連結、Open Graph 用） */
export const SITE_URL = process.env.APPOINTMENT_BASE_URL || "http://localhost:3000";
