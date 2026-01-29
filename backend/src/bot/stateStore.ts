import { getEventMeta } from "../market/mockMarketDataFeed";
import { ExecutedOrder, Position } from "../orders/orderTypes";
import type { DecisionTrigger, MarketSnapshot } from "./structuredLogger";
import { writeStructuredLog } from "./structuredLogger";

export type BotPhase = "IDLE" | "WAIT_ENTRY" | "IN_POSITION" | "EXITED";

export interface EventPhaseState {
  eventId: string;
  phase: BotPhase;
  updatedAt: number;
}

export interface PriceSnapshot {
  eventId: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  secondsToResolution: number;
  timestamp: number;
}

/** Mock 단계 사고 분석용 확장 로그 */
export interface LogEntry {
  id: number;
  timestamp: number;
  level: "INFO" | "WARN" | "ERROR";
  eventId?: string;
  message: string;
  decisionTrigger?: DecisionTrigger;
  marketSnapshot?: MarketSnapshot;
  payload?: Record<string, unknown>;
}

/** 이벤트별 요약 (진입가/청산가/손절여부/거래횟수/순손익/보유시간) */
export interface EventSummaryRow {
  eventId: string;
  eventTitle: string;
  eventScenario?: "up" | "down" | "high_volatility";
  entryPrice: number;
  exitPrice: number;
  isStopLoss: boolean;
  tradeCount: number;
  netPnlUsd: number;
  holdingTimeMs: number;
}

export interface BotRuntimeState {
  botEnabled: boolean;
  positions: Position[];
  executedOrders: ExecutedOrder[];
  realizedPnlUsd: number;
  eventPhases: Record<string, EventPhaseState>;
  prices: PriceSnapshot[];
  logs: LogEntry[];
}

export const botState: BotRuntimeState = {
  botEnabled: true,
  positions: [],
  executedOrders: [],
  realizedPnlUsd: 0,
  eventPhases: {},
  prices: [],
  logs: []
};

export function getTodayPnl(): number {
  // 간단히 전체 realizedPnlUsd 사용 (일자 분리는 추후 확장)
  return botState.realizedPnlUsd;
}

let logIdCounter = 0;

export function appendLog(entry: Omit<LogEntry, "id">) {
  logIdCounter += 1;
  const full = { ...entry, id: logIdCounter };
  botState.logs.push(full);
  if (botState.logs.length > 200) {
    botState.logs.splice(0, botState.logs.length - 200);
  }
  writeStructuredLog({
    ...entry,
    id: full.id,
    decisionTrigger: entry.decisionTrigger,
    marketSnapshot: entry.marketSnapshot,
    payload: entry.payload
  });
}

/** 포지션 기준 이벤트별 요약 리포트 계산 */
export function getEventSummary(): EventSummaryRow[] {
  const closed = botState.positions.filter(p => p.closed);
  const byEvent: Record<string, Position[]> = {};
  for (const p of closed) {
    if (!byEvent[p.eventId]) byEvent[p.eventId] = [];
    byEvent[p.eventId].push(p);
  }
  const rows: EventSummaryRow[] = [];
  for (const [eventId, positions] of Object.entries(byEvent)) {
    const title =
      botState.prices.find(pr => pr.eventId === eventId)?.title ?? eventId;
    const meta = getEventMeta(eventId);
    const entryPrice =
      positions.length > 0 ? positions[positions.length - 1].avgEntryPrice : 0;
    const lastExit = positions[positions.length - 1];
    const exitPrice = lastExit?.exitPrice ?? lastExit?.avgEntryPrice ?? 0;
    const netPnlUsd = positions.reduce((s, p) => s + (p.realizedPnlUsd ?? 0), 0);
    const holdingTimeMs = positions.reduce(
      (s, p) => s + ((p.closedTimestamp ?? Date.now()) - p.openTimestamp),
      0
    );
    const isStopLoss = positions.some(p => p.exitReason === "STOP_LOSS");
    rows.push({
      eventId,
      eventTitle: title,
      eventScenario: meta?.scenario,
      entryPrice,
      exitPrice,
      isStopLoss,
      tradeCount: positions.length,
      netPnlUsd,
      holdingTimeMs
    });
  }
  return rows;
}

export function updateEventPhase(eventId: string, phase: BotPhase) {
  botState.eventPhases[eventId] = {
    eventId,
    phase,
    updatedAt: Date.now()
  };
}

export function updatePrices(prices: PriceSnapshot[]) {
  botState.prices = prices;
}

export function resetBotState() {
  botState.positions = [];
  botState.executedOrders = [];
  botState.realizedPnlUsd = 0;
  botState.eventPhases = {};
  botState.prices = [];
  botState.logs = [];
}

