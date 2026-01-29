export type TradingMode = "mock" | "paper" | "live";

export type MarketDataMode = "MOCK" | "REPLAY" | "LIVE";

export interface ReplayConfig {
  filePath: string;
  eventId: string;
  marketTitle: string;
  resolutionTs?: string; // ISO, 파일에 없을 때 사용
  replaySpeed: number; // 1 = 실시간, 60 = 60배속
}

export interface RiskConfig {
  maxDailyLossPct: number; // e.g. -2% -> -0.02
  maxConsecutiveLosses: number; // e.g. 2
  maxConcurrentEvents: number; // e.g. 3
  maxCapitalPerEventPct: number; // e.g. 5% -> 0.05
}

export interface StrategyConfig {
  entryPriceMin: number; // 0.86
  entryPriceMax: number; // 0.89
  minHoursToExpiryForEntry: number; // 3 hours
  takeProfitMin: number; // 0.92
  takeProfitMax: number; // 0.96
  forceExitMinutesBeforeExpiry: number; // 30
  maxEntryTranchesPerEvent: number; // 2
  stopLossDropPctInMinutes: number; // -6% in given window
  stopLossWindowMinutes: number; // 10
  volumeSpikeMultiple: number; // 2x average (실데이터 단계에서 사용)
  maxVolatility30mForEntry: number; // 최근 30분 변동성 상한
}

export interface MockSimulatorConfig {
  orderFillDelayMs: number; // 주문 체결 지연 (ms)
  slippagePct: number; // 호가 갭 시뮬레이션 (0.01 = 1%)
  logFilePath: string; // JSONL 구조화 로그 저장 경로
}

export interface BotConfig {
  mode: TradingMode;
  baseCapitalUsd: number;
  risk: RiskConfig;
  strategy: StrategyConfig;
  mock?: MockSimulatorConfig;
  marketDataMode: MarketDataMode;
  replay?: ReplayConfig;
}

// NOTE: 이 파일의 값만 수정해서 전략/리스크 수치를 조정할 수 있게 한다.
export const botConfig: BotConfig = {
  mode: "mock",
  baseCapitalUsd: 1000, // 소액 실험 기준
  risk: {
    maxDailyLossPct: -0.02,
    maxConsecutiveLosses: 2,
    maxConcurrentEvents: 3,
    maxCapitalPerEventPct: 0.05
  },
  strategy: {
    entryPriceMin: 0.86,
    entryPriceMax: 0.89,
    minHoursToExpiryForEntry: 3,
    takeProfitMin: 0.92,
    takeProfitMax: 0.96,
    forceExitMinutesBeforeExpiry: 30,
    maxEntryTranchesPerEvent: 2,
    stopLossDropPctInMinutes: -0.06,
    stopLossWindowMinutes: 10,
    volumeSpikeMultiple: 2,
    maxVolatility30mForEntry: 0.01
  },
  mock: {
    orderFillDelayMs: 500,
    slippagePct: 0.005,
    logFilePath: "logs/bot.jsonl"
  },
  marketDataMode: "MOCK",
  replay: {
    filePath: "data/replays/sample_event.jsonl",
    eventId: "replay-event-1",
    marketTitle: "Replay Sample Event",
    replaySpeed: 60
  }
} as const;

export type ReadonlyBotConfig = Readonly<typeof botConfig>;
