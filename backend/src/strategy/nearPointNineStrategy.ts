import { botConfig } from "../config/tradingConfig";
import { MarketTick } from "../market/mockMarketDataFeed";
import { OrderRequest, Side } from "../orders/orderTypes";
import { RiskManager } from "../risk/riskManager";

export interface StrategyContext {
  riskManager: RiskManager;
  // 포지션/진입 횟수 등은 간단히 외부에서 관리하고 여기로 넘긴다고 가정
  existingEntryCountByEvent: Record<string, number>;
  hasOpenPositionByEvent: Record<string, boolean>;
}

export interface StrategyDecision {
  ordersToPlace: OrderRequest[];
  reason?: string;
}

export function evaluateNearPointNineStrategy(
  ticks: MarketTick[],
  ctx: StrategyContext
): StrategyDecision {
  const orders: OrderRequest[] = [];

  for (const tick of ticks) {
    const { event, yesPrice, noPrice } = tick;

    const hoursToExpiry = event.secondsToResolution / 3600;

    const existingEntries = ctx.existingEntryCountByEvent[event.id] ?? 0;
    const hasOpen = ctx.hasOpenPositionByEvent[event.id] ?? false;

    // 종료까지 남은 시간이 3시간 이상일 것
    if (hoursToExpiry < botConfig.strategy.minHoursToExpiryForEntry) {
      continue;
    }

    // 최근 30분 변동성 안정 조건
    if (tick.volatility30m > botConfig.strategy.maxVolatility30mForEntry) {
      continue;
    }

    // 손절 후 동일 이벤트 재진입 금지
    if (ctx.riskManager.hasRecentLossOnEvent(event.id)) {
      continue;
    }

    // 진입은 최대 2회 분할 매수
    if (existingEntries >= botConfig.strategy.maxEntryTranchesPerEvent) {
      continue;
    }

    // 가격 급변 체크는 1단계 Mock에선 생략/단순화 (실데이터 단계에서 구현)

    // YES/NO 가격이 0.86 ~ 0.89 사이일 때만 매수 가능
    const candidateSides: Side[] = [];
    if (
      yesPrice >= botConfig.strategy.entryPriceMin &&
      yesPrice <= botConfig.strategy.entryPriceMax
    ) {
      candidateSides.push("YES");
    }
    if (
      noPrice >= botConfig.strategy.entryPriceMin &&
      noPrice <= botConfig.strategy.entryPriceMax
    ) {
      candidateSides.push("NO");
    }

    if (candidateSides.length === 0) {
      continue;
    }

    // 이미 포지션이 있는 경우엔 2차 진입(분할)로 간주
    const size = hasOpen ? 5 : 10; // 모의 사이즈(주식 수)

    for (const side of candidateSides) {
      const price = side === "YES" ? yesPrice : noPrice;

      const order: OrderRequest = {
        eventId: event.id,
        side,
        price,
        size,
        kind: "LIMIT_BUY"
      };

      orders.push(order);
    }
  }

  return {
    ordersToPlace: orders
  };
}
