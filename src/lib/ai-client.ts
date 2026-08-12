/**
 * Anthropic client 與計價（2026-08-12）
 * 買方抽取、物件抽取共用，避免各自建 client。
 */
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-5";

/** Opus 5 單價（美金／百萬 token） */
const PRICE_IN_PER_MTOK = 5;
const PRICE_OUT_PER_MTOK = 25;
/** 粗估匯率，只為了讓成本「有感」，不是會計數字 */
const USD_TO_TWD = 32;

let _client: Anthropic | null = null;

export function aiClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("missing_anthropic_api_key");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export function aiCost(inputTokens: number, outputTokens: number): { costUsd: number; costTwd: number } {
  const costUsd =
    (inputTokens / 1_000_000) * PRICE_IN_PER_MTOK + (outputTokens / 1_000_000) * PRICE_OUT_PER_MTOK;
  return {
    costUsd: Number(costUsd.toFixed(4)),
    costTwd: Number((costUsd * USD_TO_TWD).toFixed(2)),
  };
}
