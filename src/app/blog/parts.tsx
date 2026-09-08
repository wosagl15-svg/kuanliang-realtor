import Link from "next/link";
import { OWNER, SOCIAL } from "@/config/owner";
import { CATEGORIES, type Post } from "@/lib/blog";

/**
 * 手機底部固定列。讀者想聯絡你的時候人通常在文章中段，
 * 沒有這一列就得捲回頁首找按鈕——那一捲就流失掉了。
 * 900px 以上自動隱藏（桌機有頁首導覽）。
 */
export function MobileBar() {
  return (
    <nav className="fab" aria-label="快速聯絡">
      <Link href="/card/booking">
        <span className="i" aria-hidden>📅</span>
        線上預約
      </Link>
      <a href={SOCIAL.line} target="_blank" rel="noopener noreferrer">
        <span className="i" aria-hidden>💬</span>
        LINE 諮詢
      </a>
      <a href={`tel:${OWNER.phoneRaw}`}>
        <span className="i" aria-hidden>📞</span>
        撥打電話
      </a>
    </nav>
  );
}

export function CtaBox({
  title = "有問題，直接問冠良",
  text = "台中海線買賣、稅務試算、屋況判讀。先聊聊，不用留一堆資料。",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="cta">
      <h2>{title}</h2>
      <p>{text}</p>
      <Link href="/card/booking">線上預約諮詢 →</Link>
    </section>
  );
}

export function BlogFooter() {
  return (
    <footer className="bfoot">
      {/* 分隔線交給 CSS 的 gap，不要手打「｜」——換行時那些直線會孤零零留在行尾 */}
      <div className="wrap">
        <span>
          {OWNER.company}．{OWNER.name}
        </span>
        <a href={`tel:${OWNER.phoneRaw}`}>{OWNER.phone}</a>
        <Link href="/tools">買賣屋工具</Link>
        <Link href="/blog">房產筆記</Link>
        <Link href="/">關於冠良</Link>
      </div>
    </footer>
  );
}

export function PostCard({ post }: { post: Post }) {
  return (
    <Link className="card" href={`/blog/${post.slug}`}>
      <span className="ico" aria-hidden>{post.emoji}</span>
      <span className="body">
        <span className="tagline">
          <span className="tag">{CATEGORIES[post.category].name}</span>
          <span className="meta">
            {post.date}・約 {post.readingMinutes} 分鐘
          </span>
        </span>
        <h2>{post.title}</h2>
        <p>{post.description}</p>
      </span>
    </Link>
  );
}
