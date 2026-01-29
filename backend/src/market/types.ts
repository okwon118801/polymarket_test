import { MarketEvent } from "../orders/orderTypes";

/** 전략/봇이 사용하는 통일 Tick 타입 (Mock·Replay 동일 인터페이스) */
export interface MarketTick {
  event: MarketEvent;
  yesPrice: number;
  noPrice: number;
  volumeLast30m: number;
  avgVolumeLast2h: number;
  volatility30m: number;
  timestamp: number;
}

/** 가격 히스토리 포인트 (손절 등 계산용) */
export interface PricePoint {
  timestamp: number;
  price: number;
}

/** 리플레이 파일 한 줄 (JSONL) */
export interface ReplayRow {
  ts: string; // ISO
  price: number;
  volume?: number;
  bid?: number;
  ask?: number;
  event_id?: string;
  market_title?: string;
  resolution_ts?: string; // ISO
  time_to_resolution_min?: number;
}

/** MarketDataFeed 인터페이스 – Mock / Replay 동일하게 사용 */
export interface MarketDataFeed {
  getTicks(): MarketTick[];
  getPriceHistory(eventId: string): PricePoint[];
  reset(): void;
  /** Replay 전용: start/pause/resume/stop, 없으면 no-op */
  start?(): void;
  stop?(): void;
  pause?(): void;
  resume?(): void;
  getProgress?(): { index: number; total: number; percent: number; currentTs?: string };
  setReplaySpeed?(speed: number): void;
}
