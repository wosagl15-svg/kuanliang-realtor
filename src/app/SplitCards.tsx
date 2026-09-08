"use client";

/**
 * 首頁 hero 底下的買／賣／土地分流卡。
 *
 * 為什麼要獨立成 client component：
 *   首頁是 server component，掛不了 onClick。而我們想知道的正是
 *   「買方卡跟賣方卡誰被點比較多」——這是整個首頁改版要驗證的假設。
 *   光看目的頁的瀏覽數不夠準，那兩頁從知識頁底部的導流區塊也進得來。
 *
 * track() 只送事件名與下面這三個標籤，不送任何個人資料。
 * Vercel Analytics 沒在專案啟用的話，這個呼叫會安靜地不做事，不會噴錯。
 */
import { track } from "@vercel/analytics";

export type SplitItem = { ic: string; h: string; p: string; href: string };

export default function SplitCards({ items }: { items: SplitItem[] }) {
  return (
    <div className="splitgrid">
      {items.map((s) => (
        <a
          className="splitcard"
          href={s.href}
          key={s.href}
          onClick={() => track("split_click", { label: s.h, to: s.href })}
        >
          <span className="ic" aria-hidden="true">
            {s.ic}
          </span>
          <span className="tx">
            <b>{s.h}</b>
            <span>{s.p}</span>
          </span>
          <span className="go" aria-hidden="true">
            →
          </span>
        </a>
      ))}
    </div>
  );
}
