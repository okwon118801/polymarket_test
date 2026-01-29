import { MarketEvent } from "../orders/orderTypes";
import type { MarketDataFeed, MarketTick, PricePoint } from "./types";

export type { MarketTick } from "./types";

/** 이벤트 메타 (요약 리포트·로그용) */
export interface EventMeta {
  id: string;
  title: string;
  scenario: "up" | "down" | "high_volatility";
  secondsToResolution: number;
}

const baseEvents: MarketEvent[] = [
  { id: "event-1", title: "Sample Event 1 (상승 시나리오)", secondsToResolution: 4 * 60 * 60 },
  { id: "event-2", title: "Sample Event 2 (급락 시나리오)", secondsToResolution: 6 * 60 * 60 },
  { id: "event-3", title: "Sample Event 3 (고변동 손절 검증)", secondsToResolution: 5 * 60 * 60 }
];

export function getEventMeta(eventId: string): EventMeta | undefined {
  const e = baseEvents.find(be => be.id === eventId);
  if (!e) return undefined;
  const scenario: EventMeta["scenario"] =
    e.id === "event-1" ? "up" : e.id === "event-2" ? "down" : "high_volatility";
  return { ...e, scenario };
}

let lastPrices: Record<string, number> = {
  "event-1": 0.88,
  "event-2": 0.9,
  "event-3": 0.87
};

const priceHistory: Record<string, PricePoint[]> = {
  "event-1": [],
  "event-2": [],
  "event-3": []
};

let mutableEvents: MarketEvent[] = baseEvents.map(e => ({ ...e }));

function pushPriceHistory(eventId: string, point: PricePoint) {
  const arr = priceHistory[eventId] ?? (priceHistory[eventId] = []);
  arr.push(point);
  const THIRTY_MIN_MS = 30 * 60 * 1000;
  const cutoff = point.timestamp - THIRTY_MIN_MS;
  while (arr.length && arr[0].timestamp < cutoff) arr.shift();
}

function computeVolatility30m(eventId: string): number {
  const arr = priceHistory[eventId] ?? [];
  if (arr.length < 2) return 0;
  let sumAbs = 0;
  for (let i = 1; i < arr.length; i++) sumAbs += Math.abs(arr[i].price - arr[i - 1].price);
  return sumAbs / (arr.length - 1);
}

function getTicks(): MarketTick[] {
  const now = Date.now();
  mutableEvents = mutableEvents.map(e => ({
    ...e,
    secondsToResolution: Math.max(0, e.secondsToResolution - 10)
  }));

  return mutableEvents.map(e => {
    const prev = lastPrices[e.id] ?? 0.88;
    let nextPrice = prev;
    if (e.id === "event-1") {
      nextPrice = prev + 0.0005 + (Math.random() - 0.5) * 0.005;
    } else if (e.id === "event-2") {
      const elapsedMinutes =
        (baseEvents.find(be => be.id === e.id)!.secondsToResolution - e.secondsToResolution) / 60;
      const noise = (Math.random() - 0.5) * 0.004;
      if (elapsedMinutes < 30) nextPrice = prev + noise;
      else if (elapsedMinutes < 60) nextPrice = prev - 0.0008 + noise;
      else nextPrice = prev - 0.003 + noise;
    } else {
      const elapsedMinutes =
        (baseEvents.find(be => be.id === e.id)!.secondsToResolution - e.secondsToResolution) / 60;
      const noise = (Math.random() - 0.5) * 0.008;
      if (elapsedMinutes < 20) nextPrice = prev + noise;
      else if (elapsedMinutes < 40) nextPrice = prev - 0.008 + noise;
      else nextPrice = prev - 0.002 + noise;
    }
    const bounded = Math.max(0.5, Math.min(0.99, nextPrice));
    lastPrices[e.id] = bounded;
    pushPriceHistory(e.id, { timestamp: now, price: bounded });
    const yesPrice = bounded;
    const noPrice = 1 - bounded;
    const avgVolumeLast2h = 1000;
    const volumeLast30m = avgVolumeLast2h * (0.5 + Math.random());
    const volatility30m = computeVolatility30m(e.id);
    return {
      event: e,
      yesPrice,
      noPrice,
      volumeLast30m,
      avgVolumeLast2h,
      volatility30m,
      timestamp: now
    };
  });
}

function getPriceHistoryForEvent(eventId: string): PricePoint[] {
  return priceHistory[eventId] ?? [];
}

function reset(): void {
  lastPrices = { "event-1": 0.88, "event-2": 0.9, "event-3": 0.87 };
  mutableEvents = baseEvents.map(e => ({ ...e }));
  for (const id of Object.keys(priceHistory)) priceHistory[id] = [];
}

/** Mock feed 구현 (MarketDataFeed 인터페이스) */
export const mockMarketDataFeed: MarketDataFeed = {
  getTicks,
  getPriceHistory: getPriceHistoryForEvent,
  reset
};

/** 하위 호환: 기존 getMockMarketTicks */
export function getMockMarketTicks(): MarketTick[] {
  return mockMarketDataFeed.getTicks();
}

/** 하위 호환: 기존 getPriceHistory */
export function getPriceHistory(eventId: string): PricePoint[] {
  return mockMarketDataFeed.getPriceHistory(eventId);
}

/** 하위 호환: 기존 resetMockMarket */
export function resetMockMarket(): void {
  mockMarketDataFeed.reset();
}
