import * as fs from "fs";
import * as path from "path";
import { botConfig } from "../config/tradingConfig";
import { MarketEvent } from "../orders/orderTypes";
import type { MarketDataFeed, MarketTick, PricePoint, ReplayRow } from "./types";

const BASE_TICK_MS = 1000; // 1 tick per second at 1x

/** ReplayMarketDataFeed: 과거 데이터 파일(JSONL) 기반 리플레이 */
export class ReplayMarketDataFeedImpl implements MarketDataFeed {
  private rows: ReplayRow[] = [];
  private mappedTicks: MarketTick[] = [];
  private replayIndex = 0;
  private paused = true;
  private replaySpeed = 60;
  private timer: ReturnType<typeof setInterval> | null = null;
  private eventId: string;
  private marketTitle: string;
  private resolutionTs: string | undefined;
  private onEnd?: () => void;

  constructor(options?: {
    filePath?: string;
    eventId?: string;
    marketTitle?: string;
    resolutionTs?: string;
    replaySpeed?: number;
    onEnd?: () => void;
  }) {
    const cfg = botConfig.replay;
    this.eventId = options?.eventId ?? cfg?.eventId ?? "replay-event-1";
    this.marketTitle = options?.marketTitle ?? cfg?.marketTitle ?? "Replay Event";
    this.resolutionTs = options?.resolutionTs ?? cfg?.resolutionTs;
    this.replaySpeed = options?.replaySpeed ?? cfg?.replaySpeed ?? 60;
    this.onEnd = options?.onEnd;
    const filePath = options?.filePath ?? cfg?.filePath;
    if (filePath) this.loadFile(filePath);
  }

  /** 외부에서 파일 경로 변경 시 호출 */
  loadFile(filePath: string): void {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      this.rows = [];
      this.mappedTicks = [];
      return;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    this.rows = lines.map(line => {
      try {
        return JSON.parse(line) as ReplayRow;
      } catch {
        return null;
      }
    }).filter((r): r is ReplayRow => r != null && typeof r.price === "number" && typeof r.ts === "string");

    this.mappedTicks = this.rows.map((row, i) => this.rowToTick(row, i));
    this.replayIndex = 0;
  }

  private rowToTick(row: ReplayRow, index: number): MarketTick {
    const tsMs = new Date(row.ts).getTime();
    let secondsToResolution = 0;
    if (row.time_to_resolution_min != null) {
      secondsToResolution = row.time_to_resolution_min * 60;
    } else if (row.resolution_ts) {
      secondsToResolution = Math.max(0, (new Date(row.resolution_ts).getTime() - tsMs) / 1000);
    } else if (this.resolutionTs) {
      secondsToResolution = Math.max(0, (new Date(this.resolutionTs).getTime() - tsMs) / 1000);
    }
    const event: MarketEvent = {
      id: row.event_id ?? this.eventId,
      title: row.market_title ?? this.marketTitle,
      secondsToResolution
    };
    const yesPrice = row.price;
    const noPrice = 1 - yesPrice;
    const vol = row.volume ?? 1000;
    return {
      event,
      yesPrice,
      noPrice,
      volumeLast30m: vol,
      avgVolumeLast2h: vol,
      volatility30m: index > 0 ? Math.abs(yesPrice - (this.rows[index - 1]?.price ?? yesPrice)) : 0,
      timestamp: tsMs
    };
  }

  getTicks(): MarketTick[] {
    if (this.mappedTicks.length === 0) return [];
    const idx = Math.min(this.replayIndex, this.mappedTicks.length - 1);
    return [this.mappedTicks[idx]];
  }

  getPriceHistory(eventId: string): PricePoint[] {
    if (this.mappedTicks.length === 0) return [];
    const eventTicks = this.mappedTicks.filter(t => t.event.id === eventId);
    const upTo = Math.min(this.replayIndex + 1, eventTicks.length);
    return eventTicks.slice(0, upTo).map(t => ({ timestamp: t.timestamp, price: t.yesPrice }));
  }

  reset(): void {
    this.stop();
    this.replayIndex = 0;
    this.paused = true;
  }

  start(): void {
    if (this.timer) return;
    this.paused = false;
    const intervalMs = Math.max(50, BASE_TICK_MS / this.replaySpeed);
    this.timer = setInterval(() => {
      if (this.paused) return;
      this.replayIndex += 1;
      if (this.replayIndex >= this.mappedTicks.length) {
        this.stop();
        this.onEnd?.();
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.paused = true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  setReplaySpeed(speed: number): void {
    this.replaySpeed = Math.max(0.1, speed);
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  getProgress(): { index: number; total: number; percent: number; currentTs?: string } {
    const total = this.mappedTicks.length;
    const index = Math.min(this.replayIndex, total);
    const percent = total > 0 ? (index / total) * 100 : 0;
    const currentTs = this.mappedTicks[index] ? this.rows[index]?.ts : undefined;
    return { index, total, percent, currentTs };
  }
}

let replayFeedInstance: ReplayMarketDataFeedImpl | null = null;

export function getReplayFeed(): ReplayMarketDataFeedImpl {
  if (!replayFeedInstance) replayFeedInstance = new ReplayMarketDataFeedImpl();
  return replayFeedInstance;
}

export function resetReplayFeed(): void {
  if (replayFeedInstance) {
    replayFeedInstance.reset();
  }
}
