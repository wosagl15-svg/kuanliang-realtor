# 怎麼發一篇文章

在這個資料夾放一個 `.md` 檔就好，檔名就是網址：
`wuqi-studio-trap.md` → `https://kuanhome.com/blog/wuqi-studio-trap`

列表頁、分類頁、sitemap、結構化資料、延伸閱讀全部自動產生，不用改任何程式碼。

## 檔案開頭要寫這一段

```markdown
---
title: 標題（會變成 h1 與搜尋結果的藍字）
description: 一到兩句摘要。會出現在卡片上與 Google 搜尋結果的說明文字
category: market          # knowledge 房產知識 / market 市場觀察 / local 海線在地 / case 成交現場
date: 2026-08-14          # 發布日
updated: 2026-08-20       # 選填，改過內容才填
emoji: 🏢                 # 卡片上的大圖示
tags: [梧棲, 實價登錄, 套房]
related: [/wuqi-115-price, /actual-price]   # 站內相關頁，會變成文章底部的「延伸閱讀」
draft: false              # ⚠️ 沒寫或寫 true 都不會上線
---

正文從這裡開始，用 Markdown 寫。
```

## 檔名規則

**用英文、用連字號、把關鍵字放進去。**

- ✅ `wuqi-studio-trap`、`land-loan-guide`、`shalu-school-district`
- ❌ `post1`、`2026-08-14`、中文檔名

網址是永久的，改網址等於換一篇新文章，累積的排名會歸零。**一開始就取好。**

## 兩件要注意的事

**① `draft` 沒寫就等於草稿**
這是刻意的。寧可漏發，也不要把還沒審過的文字掛上去。

**② 數字一定要標出處**
「梧棲中位單價 20.98 萬」要接著寫是哪一期、幾筆資料。這是這個站跟其他房仲網站的差別，也是被 AI 引用時的可信度來源。

## 相關連結（`related`）為什麼重要

一篇沒有任何站內連結的文章，Google 幾乎只能靠 sitemap 找到，權重也傳不出去。
每篇至少填 2～3 個相關頁面，把文章串進既有的主題群集。
