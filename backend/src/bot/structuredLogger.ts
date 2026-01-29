import * as fs from "fs";
import * as path from "path";
import { botConfig } from "../config/tradingConfig";

/** 사고 분석용 상세 로그 필드 */
export interface MarketSnapshot {
  eventId: string;
  marketTitle?: string;
  yesPrice: number;
  noPrice: number;
  volatility30m: number;
  secondsToResolution: number;
  timestamp: number;
}

export type DecisionTrigger =
  | "ENTRY_SIGNAL"
  | "TAKE_PROFIT"
  | "STOP_LOSS"
  | "FORCE_EXIT"
  | "RISK_REJECT"
  | "ORDER_FILLED";

export interface StructuredLogEntry {
  id: number;
  timestamp: number;
  level: "INFO" | "WARN" | "ERROR";
  eventId?: string;
  message: string;
  /** 결정을 유발한 트리거 */
  decisionTrigger?: DecisionTrigger;
  /** 해당 시점 시장 스냅샷 */
  marketSnapshot?: MarketSnapshot;
  /** 주문/포지션 관련 추가 데이터 */
  payload?: Record<string, unknown>;
}

let logIdCounter = 0;

function ensureLogDir(): string {
  const logPath = botConfig.mock?.logFilePath ?? "logs/bot.jsonl";
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.isAbsolute(logPath) ? logPath : path.join(process.cwd(), logPath);
}

export function writeStructuredLog(
  entry: Omit<StructuredLogEntry, "id"> & { id?: number }
): void {
  const id = entry.id ?? ++logIdCounter;
  const full: StructuredLogEntry = { ...entry, id };
  const snap = full.marketSnapshot;
  const out: Record<string, unknown> = {
    ...full,
    event_id: full.eventId,
    market_title: snap?.marketTitle ?? (full.payload as Record<string, unknown> | undefined)?.market_title,
    tick_ts: snap?.timestamp != null ? new Date(snap.timestamp).toISOString() : undefined,
    price: snap?.yesPrice,
    time_to_resolution_min: snap?.secondsToResolution != null ? snap.secondsToResolution / 60 : undefined,
    trigger: full.decisionTrigger
  };
  try {
    const filePath = ensureLogDir();
    fs.appendFileSync(filePath, JSON.stringify(out) + "\n", "utf8");
  } catch (err) {
    console.error("[structuredLogger] write failed", err);
  }
}
