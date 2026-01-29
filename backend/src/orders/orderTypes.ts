export type Side = "YES" | "NO";

export type OrderKind = "LIMIT_BUY" | "LIMIT_SELL" | "LIMIT_EXIT" | "LIMIT_STOP_LOSS";
// NOTE: MARKET 타입은 의도적으로 지원하지 않는다.

export interface MarketEvent {
  id: string;
  title: string;
  // seconds until event resolution
  secondsToResolution: number;
}

export interface OrderRequest {
  eventId: string;
  side: Side;
  price: number; // 0 ~ 1
  size: number; // shares
  kind: OrderKind;
}

export interface ExecutedOrder extends OrderRequest {
  id: string;
  timestamp: number;
  filledPrice: number;
}

export type ExitReason = "TAKE_PROFIT" | "STOP_LOSS" | "FORCE_EXIT";

export interface Position {
  id: string;
  eventId: string;
  side: Side;
  avgEntryPrice: number;
  size: number;
  openTimestamp: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  closed: boolean;
  closedTimestamp?: number;
  exitPrice?: number;
  exitReason?: ExitReason;
}

export interface PnlSnapshot {
  date: string; // YYYY-MM-DD
  realizedPnlUsd: number;
}
