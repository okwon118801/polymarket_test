import { MarketEvent } from "../orders/orderTypes";

export interface MarketTick {
  event: MarketEvent;
  yesPrice: number;
  noPrice: number;
  volumeLast30m: number;
  avgVolumeLast2h: number;
  // 최근 30분 변동성(단순 절대 변화량 평균)
  volatility30m: number;
  timestamp: number;
}

// 1단계용: 현실적인 패턴이 섞인 Mock 데이터
// - event-1: 완만한 상승 후 0.96 근처 도달 (익절 테스트)
// - event-2: 횡보 후 급락 이벤트 (손절 테스트)
const baseEvents: MarketEvent[] = [
  {
    id: "event-1",
    title: "Sample Event 1 (상승 시나리오)",
    secondsToResolution: 4 * 60 * 60
  },
  {
    id: "event-2",
    title: "Sample Event 2 (급락 시나리오)",
    secondsToResolution: 6 * 60 * 60
  }
];

type PricePoint = { timestamp: number; price: number };

let lastPrices: Record<string, number> = {
  "event-1": 0.88,
  "event-2": 0.9
};

// 이벤트별 가격 히스토리 (최근 30분 이내만 유지)
const priceHistory: Record<string, PricePoint[]> = {
  "event-1": [],
  "event-2": []
};

// 남은 시간도 매 틱마다 감소시키기 위해 복사본 사용
let mutableEvents: MarketEvent[] = baseEvents.map(e => ({ ...e }));

export function resetMockMarket() {
  lastPrices = {
    "event-1": 0.88,
    "event-2": 0.9
  };
  mutableEvents = baseEvents.map(e => ({ ...e }));
  for (const id of Object.keys(priceHistory)) {
    priceHistory[id] = [];
  }
}

function pushPriceHistory(eventId: string, point: PricePoint) {
  const arr = priceHistory[eventId] ?? (priceHistory[eventId] = []);
  arr.push(point);
  const THIRTY_MIN_MS = 30 * 60 * 1000;
  const cutoff = point.timestamp - THIRTY_MIN_MS;
  // 30분 이전 데이터는 버림
  while (arr.length && arr[0].timestamp < cutoff) {
    arr.shift();
  }
}

function computeVolatility30m(eventId: string): number {
  const arr = priceHistory[eventId] ?? [];
  if (arr.length < 2) return 0;
  let sumAbs = 0;
  for (let i = 1; i < arr.length; i++) {
    sumAbs += Math.abs(arr[i].price - arr[i - 1].price);
  }
  return sumAbs / (arr.length - 1);
}

export function getPriceHistory(eventId: string): PricePoint[] {
  return priceHistory[eventId] ?? [];
}

export function getMockMarketTicks(): MarketTick[] {
  const now = Date.now();

  mutableEvents = mutableEvents.map(e => ({
    ...e,
    secondsToResolution: Math.max(0, e.secondsToResolution - 10)
  }));

  return mutableEvents.map(e => {
    const prev = lastPrices[e.id] ?? 0.88;

    let nextPrice = prev;
    if (e.id === "event-1") {
      // 완만한 상승 시나리오: 서서히 0.96 근처로
      const drift = 0.0005;
      const noise = (Math.random() - 0.5) * 0.005;
      nextPrice = prev + drift + noise;
    } else {
      // 횡보 후 특정 시점에 급락
      const elapsedMinutes =
        (baseEvents.find(be => be.id === e.id)!.secondsToResolution -
          e.secondsToResolution) /
        60;
      const noise = (Math.random() - 0.5) * 0.004;
      if (elapsedMinutes < 30) {
        // 초기 30분: 0.9 근처 횡보
        nextPrice = prev + noise;
      } else if (elapsedMinutes < 60) {
        // 30~60분: 살짝 하락
        nextPrice = prev - 0.0008 + noise;
      } else {
        // 이후: 손절 테스트용 급락 구간
        nextPrice = prev - 0.003 + noise;
      }
    }

    const bounded = Math.max(0.5, Math.min(0.99, nextPrice));
    lastPrices[e.id] = bounded;

    pushPriceHistory(e.id, { timestamp: now, price: bounded });

    const yesPrice = bounded;
    const noPrice = 1 - bounded;

    const avgVolumeLast2h = 1000;
    const volumeLast30m = avgVolumeLast2h * (0.5 + Math.random());

    const volatility30m = computeVolatility30m(e.id);

    return {
      event: e,
      yesPrice,
      noPrice,
      volumeLast30m,
      avgVolumeLast2h,
      volatility30m,
      timestamp: now
    };
  });
}
