import { ExecutedOrder, Position } from "../orders/orderTypes";

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

export interface LogEntry {
  id: number;
  timestamp: number;
  level: "INFO" | "WARN" | "ERROR";
  eventId?: string;
  message: string;
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
  botState.logs.push({ ...entry, id: logIdCounter });
  // 로그는 최근 200개만 유지
  if (botState.logs.length > 200) {
    botState.logs.splice(0, botState.logs.length - 200);
  }
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

