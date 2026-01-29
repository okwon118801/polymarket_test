import { botConfig } from "../config/tradingConfig";
import type { MarketDataMode } from "../config/tradingConfig";
import type { MarketDataFeed } from "./types";
import { mockMarketDataFeed } from "./mockMarketDataFeed";
import { getReplayFeed } from "./replayMarketDataFeed";

let cachedFeed: MarketDataFeed | null = null;
let runtimeMode: MarketDataMode | null = null;

export function getMarketDataMode(): MarketDataMode {
  return runtimeMode ?? botConfig.marketDataMode ?? "MOCK";
}

export function setMarketDataMode(mode: MarketDataMode): void {
  runtimeMode = mode;
  clearFeedCache();
}

export function getMarketDataFeed(): MarketDataFeed {
  if (cachedFeed) return cachedFeed;
  const mode = getMarketDataMode();
  if (mode === "REPLAY") {
    cachedFeed = getReplayFeed();
  } else {
    cachedFeed = mockMarketDataFeed;
  }
  return cachedFeed;
}

export function clearFeedCache(): void {
  cachedFeed = null;
}
