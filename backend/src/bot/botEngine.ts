import { botConfig } from "../config/tradingConfig";
import { clearFeedCache, getMarketDataFeed } from "../market/feedFactory";
import type { MarketTick } from "../market/types";
import { MockOrderExecutor } from "../orders/mockOrderExecutor";
import { OrderRequest, Position } from "../orders/orderTypes";
import { RiskManager } from "../risk/riskManager";
import {
  appendLog,
  botState,
  updateEventPhase,
  updatePrices,
  resetBotState
} from "./stateStore";

function marketSnapshotFromTick(tick: { event: { id: string; title: string; secondsToResolution: number }; yesPrice: number; noPrice: number; volatility30m: number; timestamp: number }) {
  return {
    eventId: tick.event.id,
    marketTitle: tick.event.title,
    yesPrice: tick.yesPrice,
    noPrice: tick.noPrice,
    volatility30m: tick.volatility30m,
    secondsToResolution: tick.event.secondsToResolution,
    timestamp: tick.timestamp
  };
}

const POLL_INTERVAL_MS = 10_000;

export class BotEngine {
  private timer: NodeJS.Timeout | null = null;
  private riskManager = new RiskManager();
  private executor = new MockOrderExecutor();

  start() {
    if (this.timer) return;
    const feed = getMarketDataFeed();
    feed.start?.();
    this.timer = setInterval(() => this.tick().catch(console.error), POLL_INTERVAL_MS);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    getMarketDataFeed().stop?.();
  }

  isRunning() {
    return !!this.timer;
  }

  resetScenario() {
    resetBotState();
    getMarketDataFeed().reset();
    clearFeedCache();
    this.riskManager = new RiskManager();
  }

  private async tick() {
    if (!botState.botEnabled) return;

    const feed = getMarketDataFeed();
    const ticks = feed.getTicks();

    // UI용 현재 가격 스냅샷 저장
    updatePrices(
      ticks.map(t => ({
        eventId: t.event.id,
        title: t.event.title,
        yesPrice: t.yesPrice,
        noPrice: t.noPrice,
        secondsToResolution: t.event.secondsToResolution,
        timestamp: t.timestamp
      }))
    );

    // 자동 청산 / 손절 체크 먼저
    await this.handleExitsAndStopLoss(ticks);

    // 진입 전략 실행
    const existingEntryCountByEvent: Record<string, number> = {};
    const hasOpenPositionByEvent: Record<string, boolean> = {};

    for (const p of botState.positions) {
      if (p.closed) continue;
      existingEntryCountByEvent[p.eventId] =
        (existingEntryCountByEvent[p.eventId] ?? 0) + 1;
      hasOpenPositionByEvent[p.eventId] = true;
    }

    const { evaluateNearPointNineStrategy } = await import(
      "../strategy/nearPointNineStrategy"
    );

    const decision = evaluateNearPointNineStrategy(ticks, {
      riskManager: this.riskManager,
      existingEntryCountByEvent,
      hasOpenPositionByEvent
    });

    for (const order of decision.ordersToPlace) {
      await this.tryExecuteEntryOrder(order, ticks);
    }
  }

  private async handleExitsAndStopLoss(ticks: MarketTick[]) {
    for (const pos of botState.positions) {
      if (pos.closed) continue;
      const tick = ticks.find(t => t.event.id === pos.eventId);
      if (!tick) continue;

      const currentPrice = pos.side === "YES" ? tick.yesPrice : tick.noPrice;
      const priceHist = getMarketDataFeed().getPriceHistory(pos.eventId);

      // 10분 내 -6% 하락 체크
      const TEN_MIN_MS = botConfig.strategy.stopLossWindowMinutes * 60 * 1000;
      const cutoff = Date.now() - TEN_MIN_MS;
      const past = [...priceHist].reverse().find(p => p.timestamp <= cutoff);

      let shouldStopLoss = false;
      if (past) {
        const pctChange = (currentPrice - past.price) / past.price;
        if (pctChange <= botConfig.strategy.stopLossDropPctInMinutes) {
          shouldStopLoss = true;
        }
      }

      const hoursToExpiry = tick.event.secondsToResolution / 3600;
      const minutesToExpiry = tick.event.secondsToResolution / 60;

      const reachedTakeProfit =
        currentPrice >= botConfig.strategy.takeProfitMin &&
        currentPrice <= botConfig.strategy.takeProfitMax;

      const forceExit =
        minutesToExpiry <= botConfig.strategy.forceExitMinutesBeforeExpiry;

      if (shouldStopLoss) {
        await this.closePosition(pos, currentPrice, "STOP_LOSS");
      } else if (reachedTakeProfit || forceExit) {
        await this.closePosition(
          pos,
          currentPrice,
          reachedTakeProfit ? "TAKE_PROFIT" : "FORCE_EXIT"
        );
      } else {
        // 포지션 상태 머신 업데이트
        updateEventPhase(pos.eventId, "IN_POSITION");
      }
    }
  }

  private async tryExecuteEntryOrder(order: OrderRequest, ticks: MarketTick[]) {
    const notionalUsd = order.price * order.size * botConfig.baseCapitalUsd;

    const riskCheck = this.riskManager.canPlaceOrder(order, notionalUsd);
    if (!riskCheck.allowed) {
      appendLog({
        timestamp: Date.now(),
        level: "WARN",
        eventId: order.eventId,
        message: `진입 거부 (리스크 한도 초과): ${riskCheck.reason}`,
        decisionTrigger: "RISK_REJECT",
        payload: { reason: riskCheck.reason }
      });
      return;
    }

    const tick = ticks.find(t => t.event.id === order.eventId);
    const exec = await this.executor.execute(order);
    botState.executedOrders.push(exec);

    const position: Position = {
      id: exec.id,
      eventId: exec.eventId,
      side: exec.side,
      avgEntryPrice: exec.filledPrice,
      size: exec.size,
      openTimestamp: exec.timestamp,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      closed: false
    };

    botState.positions.push(position);
    this.riskManager.onPositionOpened(position);

    updateEventPhase(order.eventId, "IN_POSITION");
    appendLog({
      timestamp: Date.now(),
      level: "INFO",
      eventId: order.eventId,
      message: `진입 (LIMIT BUY) side=${order.side} price=${order.price.toFixed(3)} size=${order.size} filled=${exec.filledPrice.toFixed(3)}`,
      decisionTrigger: "ORDER_FILLED",
      marketSnapshot: tick ? marketSnapshotFromTick(tick) : undefined,
      payload: { orderPrice: order.price, filledPrice: exec.filledPrice, size: order.size }
    });
  }

  private async closePosition(
    position: Position,
    exitPrice: number,
    reason: "TAKE_PROFIT" | "STOP_LOSS" | "FORCE_EXIT"
  ) {
    if (position.closed) return;

    const pnlPerShare =
      position.side === "YES"
        ? exitPrice - position.avgEntryPrice
        : position.avgEntryPrice - exitPrice;
    const realized = pnlPerShare * position.size * botConfig.baseCapitalUsd;

    position.closed = true;
    position.closedTimestamp = Date.now();
    position.realizedPnlUsd = realized;
    position.exitPrice = exitPrice;
    position.exitReason = reason;

    botState.realizedPnlUsd += realized;
    this.riskManager.onPositionClosed(position, realized);
    updateEventPhase(position.eventId, "EXITED");

    const trigger =
      reason === "TAKE_PROFIT"
        ? "TAKE_PROFIT"
        : reason === "STOP_LOSS"
          ? "STOP_LOSS"
          : "FORCE_EXIT";
    const ticks = getMarketDataFeed().getTicks();
    const tick = ticks.find(t => t.event.id === position.eventId);

    appendLog({
      timestamp: Date.now(),
      level: realized >= 0 ? "INFO" : "WARN",
      eventId: position.eventId,
      message: `청산 (${reason}) price=${exitPrice.toFixed(3)} pnlUsd=${realized.toFixed(2)}`,
      decisionTrigger: trigger,
      marketSnapshot: tick ? marketSnapshotFromTick(tick) : undefined,
      payload: {
        entryPrice: position.avgEntryPrice,
        exitPrice,
        size: position.size,
        realizedPnlUsd: realized,
        holdingMs: (position.closedTimestamp ?? Date.now()) - position.openTimestamp
      }
    });
  }
}

export const botEngine = new BotEngine();

