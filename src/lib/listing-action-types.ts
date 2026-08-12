/**
 * 物件 server action 的輸入／輸出型別（2026-08-12）
 * 獨立一檔的原因同 buyer-action-types.ts：`"use server"` 檔只能匯出 async 函式。
 */
import type { ExtractedListing } from "@/lib/listing-extract";

export type ListingExtractActionResult = {
  ok: boolean;
  error?: string;
  data?: ExtractedListing;
  usage?: { inputTokens: number; outputTokens: number; costTwd: number };
  communityHits?: Array<{ id: string; name: string; matchKind: string }>;
};

export type SaveListingInput = {
  title: string;
  communityId?: string | null;
  district: string;
  address?: string | null;
  price?: number | null;
  sizePing?: number | null;
  rooms?: number | null;
  livingRooms?: number | null;
  baths?: number | null;
  floorNo?: number | null;
  totalFloors?: number | null;
  ageYear?: number | null;
  hasElevator?: boolean | null;
  parkingCount?: number;
  tags?: string[];
  note?: string | null;
};
