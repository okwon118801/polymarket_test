export type TradingMode = "mock" | "paper" | "live";

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

export interface BotConfig {
  mode: TradingMode;
  baseCapitalUsd: number;
  risk: RiskConfig;
  strategy: StrategyConfig;
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
  }
} as const;

export type ReadonlyBotConfig = Readonly<typeof botConfig>;
