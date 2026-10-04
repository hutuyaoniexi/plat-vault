export interface ScreenshotAsset { id: string; name: string; objectUrl: string; file: File; }

export interface RawInventoryEntry {
  id: string;
  rawText: string;
  bbox?: { x: number; y: number; width: number; height: number };
}

export type EntryStatus = 'matched' | 'unmatched' | 'unsupported';
export interface MatchedInventoryEntry {
  raw: RawInventoryEntry;
  slug?: string;
  ducats?: number;
  status: EntryStatus;
}

export interface PriceQuote { slug: string; ingameSellPrice: number | null; referenceSellPrice: number | null; }
export interface ValuedInventoryItem {
  slug: string;
  displayName: string;
  ducats?: number;
  quote: PriceQuote | null;
}
