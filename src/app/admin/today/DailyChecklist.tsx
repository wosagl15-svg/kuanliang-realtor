"use client";

/**
 * 每日固定工作清單（2026-08-22）
 *
 * 進度存在瀏覽器 localStorage，一天一把 key。為什麼不進資料庫：
 *   這是給自己看的自律工具，不是要交給誰的報表。存本機就沒有登入、
 *   沒有網路延遲、勾起來是即時的——一旦要等 server 轉圈，就不會有人天天勾。
 *   換電腦會歸零，這是可以接受的代價。
 *
 * 跨日自動清空（key 帶日期），順便把七天前的舊 key 刪掉，不讓它無限長大。
 */

import { useEffect, useMemo, useState } from "react";
import { CIS, CHIP, FS } from "@/app/admin/_components/cis";
import type { DailyTask, DailyTaskBlock } from "@/lib/daily-tasks";

const KEY_PREFIX = "kh-daily-tasks-";

function loadDone(dateKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + dateKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 只留最近 7 天，其餘刪掉 */
function pruneOldKeys(dateKey: string) {
  try {
    const keep = new Set<string>();
    const today = new Date(`${dateKey}T00:00:00Z`).getTime();
    for (let i = 0; i < 7; i += 1) {
      keep.add(new Date(today - i * 86400_000).toISOString().slice(0, 10));
    }
    const drop: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX) && !keep.has(k.slice(KEY_PREFIX.length))) drop.push(k);
    }
    drop.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* localStorage 被關掉就算了，不影響功能 */
  }
}

export default function DailyChecklist({
  dateKey,
  blocks,
  tasks,
}: {
  dateKey: string;
  blocks: DailyTaskBlock[];
  tasks: DailyTask[];
}) {
  const [done, setDone] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDone(loadDone(dateKey));
    setReady(true);
    pruneOldKeys(dateKey);
  }, [dateKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY_PREFIX + dateKey, JSON.stringify(done));
    } catch {
      /* 無痕模式寫不進去，勾選在這次瀏覽期間仍然有效 */
    }
  }, [done, dateKey, ready]);

  const doneSet = useMemo(() => new Set(done), [done]);
  const pct = tasks.length ? Math.round((doneSet.size / tasks.length) * 100) : 0;

  function toggle(id: string) {
    setDone((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <section
      id="daily-checklist"
      style={{
        background: CIS.card,
        border: `1px solid ${CIS.cardBorder}`,
        borderRadius: CIS.radius,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: FS(17), fontWeight: 800, margin: 0 }}>✅ 每天都要做的事</h2>
        <span style={{ fontSize: FS(12), color: CIS.textMute }}>
          沒人會提醒你的那些——漏掉不會馬上痛，兩個月後才發現沒案子
        </span>
      </div>

      {/* 進度條 */}
      <div style={{ marginTop: 14, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: FS(12), fontWeight: 700, color: CIS.textSub }}>
            今天完成 {doneSet.size} / {tasks.length}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: FS(12), fontWeight: 800, color: pct === 100 ? "#0f7a45" : CIS.blueSoft }}>
              {pct}%
            </span>
            {doneSet.size > 0 && (
              <button
                type="button"
                onClick={() => setDone([])}
                style={{
                  fontSize: FS(10),
                  color: CIS.textMute,
                  background: "none",
                  border: `1px solid ${CIS.cardBorder}`,
                  borderRadius: 999,
                  padding: "2px 10px",
                  cursor: "pointer",
                }}
              >
                重設
              </button>
            )}
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: CIS.panel, overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 999,
              background: pct === 100 ? "#0f7a45" : `linear-gradient(90deg, ${CIS.blueDeep}, ${CIS.blue})`,
              transition: "width .2s ease",
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {blocks.map((block) => {
          const items = tasks.filter((t) => t.block === block.key);
          if (!items.length) return null;
          const blockDone = items.filter((t) => doneSet.has(t.id)).length;
          const allDone = blockDone === items.length;
          const chip = allDone ? CHIP.success : CHIP.neutral;

          return (
            <div key={block.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: FS(14) }}>{block.emoji}</span>
                <span style={{ fontSize: FS(13), fontWeight: 800 }}>{block.label}</span>
                <span
                  style={{
                    fontSize: FS(10),
                    fontVariantNumeric: "tabular-nums",
                    color: CIS.textMute,
                    border: `1px solid ${CIS.cardBorder}`,
                    borderRadius: 999,
                    padding: "1px 8px",
                  }}
                >
                  {block.time}
                </span>
                <span
                  style={{
                    fontSize: FS(10),
                    fontWeight: 700,
                    padding: "1px 8px",
                    borderRadius: 999,
                    background: chip.bg,
                    color: chip.color,
                    border: `1px solid ${chip.border}`,
                  }}
                >
                  {blockDone}/{items.length}
                </span>
                <span style={{ fontSize: FS(11), color: CIS.textMute }}>{block.theme}</span>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {items.map((task) => {
                  const isDone = doneSet.has(task.id);
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "9px 12px",
                        borderRadius: CIS.radiusSm,
                        background: isDone ? CIS.panel : CIS.card,
                        border: `1px solid ${isDone ? CIS.panelBorder : CIS.cardBorder}`,
                        opacity: isDone ? 0.62 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggle(task.id)}
                        aria-label={task.title}
                        style={{ width: 18, height: 18, marginTop: 2, accentColor: CIS.blue, cursor: "pointer", flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            onClick={() => toggle(task.id)}
                            style={{
                              fontSize: FS(13),
                              fontWeight: 700,
                              cursor: "pointer",
                              textDecoration: isDone ? "line-through" : "none",
                            }}
                          >
                            {task.title}
                          </span>
                          {task.target && (
                            <span
                              style={{
                                fontSize: FS(10),
                                fontWeight: 800,
                                padding: "1px 8px",
                                borderRadius: 999,
                                background: CHIP.warn.bg,
                                color: CHIP.warn.color,
                                border: `1px solid ${CHIP.warn.border}`,
                              }}
                            >
                              目標 {task.target}
                            </span>
                          )}
                          {task.href && (
                            <a
                              href={task.href}
                              target={task.href.startsWith("http") ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              style={{ fontSize: FS(10), color: CIS.blueSoft, fontWeight: 700 }}
                            >
                              去做 →
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: FS(11), color: CIS.textMute, marginTop: 2, lineHeight: 1.5 }}>
                          {task.hint}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
