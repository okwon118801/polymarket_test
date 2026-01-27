import { botConfig } from "../config/tradingConfig";
import { ExecutedOrder, OrderRequest, Position } from "../orders/orderTypes";

export interface RiskState {
  readonly date: string; // YYYY-MM-DD
  dailyRealizedPnlUsd: number;
  consecutiveLosses: number;
  activePositions: Position[];
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export class RiskManager {
  private state: RiskState;

  constructor(initialState?: RiskState) {
    const today = new Date().toISOString().slice(0, 10);
    this.state =
      initialState ??
      {
        date: today,
        dailyRealizedPnlUsd: 0,
        consecutiveLosses: 0,
        activePositions: []
      };
  }

  getState(): RiskState {
    return this.state;
  }

  // 날짜가 바뀌면 일일 손실/연속 손실 리셋
  private ensureDate() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.state.date !== today) {
      this.state = {
        ...this.state,
        date: today,
        dailyRealizedPnlUsd: 0,
        consecutiveLosses: 0
      };
    }
  }

  private get maxDailyLossUsd() {
    return botConfig.baseCapitalUsd * botConfig.risk.maxDailyLossPct;
  }

  private get maxCapitalPerEventUsd() {
    return botConfig.baseCapitalUsd * botConfig.risk.maxCapitalPerEventPct;
  }

  // 주문 실행 전, 리스크 관점에서 허용 여부를 체크
  canPlaceOrder(req: OrderRequest, notionalUsd: number): RiskCheckResult {
    this.ensureDate();

    // 하루 손실 한도 초과 여부
    if (this.state.dailyRealizedPnlUsd <= this.maxDailyLossUsd) {
      return { allowed: false, reason: "일일 손실 한도 도달 – 봇 중지" };
    }

    // 연속 손실 초과 여부
    if (this.state.consecutiveLosses >= botConfig.risk.maxConsecutiveLosses) {
      return { allowed: false, reason: "연속 손실 한도 도달 – 봇 중지" };
    }

    // 동시에 활성화 가능한 이벤트 수 제한
    const activeEventIds = new Set(
      this.state.activePositions.filter(p => !p.closed).map(p => p.eventId)
    );
    if (
      !activeEventIds.has(req.eventId) &&
      activeEventIds.size >= botConfig.risk.maxConcurrentEvents
    ) {
      return { allowed: false, reason: "동시 활성 이벤트 최대 개수 초과" };
    }

    // 이벤트당 최대 투자금 제한
    const existingExposureUsd = this.state.activePositions
      .filter(p => p.eventId === req.eventId && !p.closed)
      .reduce((sum, p) => sum + p.avgEntryPrice * p.size, 0);

    if (existingExposureUsd + notionalUsd > this.maxCapitalPerEventUsd) {
      return { allowed: false, reason: "이벤트당 최대 투자금 한도 초과" };
    }

    return { allowed: true };
  }

  // 손절 후 동일 이벤트 재진입 금지용: 최근에 손실로 종료된 이벤트 보유 여부 체크
  hasRecentLossOnEvent(eventId: string): boolean {
    return this.state.activePositions.some(
      p => p.eventId === eventId && p.closed && p.realizedPnlUsd < 0
    );
  }

  // 체결 후 PnL 기반으로 상태 업데이트
  onPositionClosed(position: Position, realizedPnlUsd: number) {
    this.ensureDate();

    this.state.dailyRealizedPnlUsd += realizedPnlUsd;

    if (realizedPnlUsd < 0) {
      this.state.consecutiveLosses += 1;
    } else if (realizedPnlUsd > 0) {
      this.state.consecutiveLosses = 0;
    }

    // activePositions 업데이트
    const idx = this.state.activePositions.findIndex(p => p.id === position.id);
    if (idx >= 0) {
      this.state.activePositions[idx] = {
        ...position,
        realizedPnlUsd,
        closed: true,
        closedTimestamp: Date.now()
      };
    } else {
      this.state.activePositions.push({
        ...position,
        realizedPnlUsd,
        closed: true,
        closedTimestamp: Date.now()
      });
    }
  }

  onPositionOpened(position: Position) {
    this.ensureDate();
    this.state.activePositions.push(position);
  }
}
