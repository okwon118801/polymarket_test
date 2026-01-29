# Polymarket 0.9 근처 자동매매 봇 (MVP)

이 프로젝트는 Polymarket 단기 이벤트(가격 0.9 근처)를 대상으로 **소액 자동매매 전략을 실험하기 위한** 웹 기반 자동 트레이딩 봇입니다.  
수익 극대화보다는 **사고 방지와 통제 가능성**을 우선합니다.

## 구조

- `backend` – Node.js + TypeScript
  - `config/tradingConfig.ts` – **전략/리스크 모든 수치가 모이는 단일 설정 파일**
  - `risk/riskManager.ts` – 하루 최대 손실, 연속 손실, 이벤트당/동시 이벤트 제한 등 **최상위 리스크 모듈**
  - `strategy/nearPointNineStrategy.ts` – 0.86~0.89 진입, 0.92~0.96 청산, 종료 30분 전 강제 청산 등 전략 로직
  - `orders/` – **지정가(LIMIT) 주문만을 지원하는** 주문 타입/실행 모듈 (1단계는 Mock 실행)
  - `market/types.ts` – **MarketTick / MarketDataFeed 인터페이스** (Mock·Replay 공통)
  - `market/mockMarketDataFeed.ts` – MOCK 모드용 가짜 시세 생성
  - `market/replayMarketDataFeed.ts` – **REPLAY 모드용** 과거 데이터(JSONL) 리플레이
  - `market/feedFactory.ts` – config `marketDataMode`에 따라 MOCK/REPLAY feed 반환
  - `bot/botEngine.ts` – 주기적인 데이터 수집 → 전략 판단 → 리스크 체크 → 주문 실행 루프
  - `api/server.ts` – `/api/status`, `/api/bot/toggle`, `/api/market-mode`, `/api/replay/*` 등 REST API
  - `data/replays/sample_event.jsonl` – 샘플 리플레이 데이터 (0.86~0.96 가격 + 급락 구간)
- `frontend` – React + TypeScript + Vite
  - 봇 ON/OFF 토글, 활성 포지션, 오늘 손익 등을 보여주는 간단한 대시보드

## 실행 방법

```bash
cd backend
npm install
cd ../frontend
npm install

cd ..
npm install

npm run dev
```

- 백엔드: `http://localhost:4001`
- 프론트엔드: `http://localhost:5173`

## Mock vs Replay 차이

| 구분 | MOCK | REPLAY |
|------|------|--------|
| 데이터 소스 | 코드 내부에서 가짜 시세 생성 (랜덤/시나리오) | **과거 데이터 파일(JSONL)** 을 한 줄씩 재생 |
| 용도 | 전략·리스크 로직 검증, UI/플로우 테스트 | 동일 전략을 **고정된 과거 구간**에서 반복 검증 |
| 시간 | 실시간 타이머(10초 간격 틱) | 재생 속도(1x, 60x 등)에 따라 틱 진행 |
| 파일 | 없음 | `backend/data/replays/*.jsonl` (샘플: `sample_event.jsonl`) |

### REPLAY 모드 실행 방법

1. **백엔드는 반드시 `backend` 디렉토리에서 실행** (리플레이 파일 경로 `data/replays/` 기준).

   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. 프론트엔드에서 Data Mode를 **REPLAY**로 선택.
3. 리플레이 파일 선택 (예: `sample_event.jsonl`), 배속(1x/10x/60x/120x) 선택.
4. **재생** 클릭 후 **봇 시작** 클릭 → 리플레이가 진행되며 봇이 자동매매 판단.
5. **일시정지 / 재개 / 정지**로 재생 제어. 진행률과 현재 tick 시각(ts)은 UI에 표시됨.

리플레이 데이터 형식(JSONL 한 줄 예시):

```json
{"ts":"2025-12-01T10:00:00Z","price":0.878,"volume":1200,"time_to_resolution_min":240}
```

파일에 `event_id`, `market_title`, `resolution_ts` 등이 없으면 `tradingConfig.replay` 에서 지정한 값이 사용됩니다.

## 리스크 관리 및 안전장치

### 1. 하루 최대 손실 한도

- `tradingConfig.ts` 의 `risk.maxDailyLossPct` 로 관리합니다.
- 내부적으로 `baseCapitalUsd * maxDailyLossPct` 를 손실 한도로 계산하고,  
  **일별 누적 실현 손익이 이 값 이하로 떨어지면 새 주문을 차단**합니다.

### 2. 연속 손실 2회 시 봇 중지

- `riskManager` 가 포지션 종료 시 손익을 기록하고,  
  손실이 발생하면 `consecutiveLosses` 를 증가시킵니다.
- `consecutiveLosses >= maxConsecutiveLosses` 가 되면 **모든 신규 주문을 거부**합니다.

### 3. 동시에 활성 이벤트 최대 3개

- `risk.maxConcurrentEvents` 로 제어합니다.
- 현재 열려 있는 포지션의 이벤트 집합을 계산하여,  
  이미 3개 이벤트가 활성인 경우 **새 이벤트에 대한 진입 주문을 거부**합니다.

### 4. 이벤트당 최대 투자금 5%

- `risk.maxCapitalPerEventPct` 로 관리합니다.
- 이벤트별 기존 익스포저(진입 가격 × 수량)를 합산해  
  `baseCapitalUsd * maxCapitalPerEventPct` 를 초과하면 해당 이벤트에 대한 추가 진입을 차단합니다.

### 5. 손절 후 동일 이벤트 재진입 금지

- `riskManager.hasRecentLossOnEvent` 로, 손실로 종료된 이벤트에 대해 재진입을 막도록 확장 가능합니다.

## 전략 로직 개요

- **진입**
  - YES/NO 가격이 **0.86 ~ 0.89** 사이일 때만 매수
  - 이벤트 종료까지 남은 시간이 **3시간 이상**
  - 이벤트당 **최대 2회 분할 매수**
- **청산**
  - YES/NO 가격이 **0.92 ~ 0.96** 도달 시 지정가 매도
  - 이벤트 종료 **30분 전에는 무조건 전량 청산** (결과 확정 직전 포지션 보유 금지)
- **손절**
  - 1단계 Mock에서는 단순화되어 있으며, 실데이터 단계에서
    - 10분 내 -6% 이상 하락
    - 거래량 급증(최근 평균 대비 2배)
    - 조건을 체크하여 지정가 손절 주문을 발행하도록 확장합니다.

## 시장가 주문을 사용하지 않는 이유

예측시장(특히 유동성이 얇은 Polymarket)에서는 **시장가 주문이 큰 가격 슬리피지와 갑작스러운 손실**을 유발할 수 있습니다.

- 주문 순간 오더북 유동성이 비어 있으면, 시장가는 **의도와 전혀 다른 가격**에 체결될 수 있습니다.
- 급등락 구간에서 시장가를 사용하면, 전략에서 가정한 리스크 한도(예: -2%, -6%)를 **한 번에 크게 초과**할 수 있습니다.
- 본 프로젝트의 목적은 **소액 실험과 사고 방지**이므로,  
  주문 구조 자체를 **LIMIT 기반으로만 설계**하여
  - 가격이 불리하게 튀면 **그냥 체결이 안 되도록**
  - 체결이 되더라도 **예측 가능한 가격 범위 내**에서만 체결되도록 강제합니다.

코드 레벨에서도:

- `orders/orderTypes.ts` 의 `OrderKind` 에 **시장가 관련 타입을 정의하지 않고**
- 주문 실행 모듈(`mockOrderExecutor`, 이후 실거래 executor)도 **LIMIT 주문만 처리**하게 구현함으로써
- **시장가 주문을 실수로라도 호출할 수 없는 구조**를 만듭니다.

## 개발 단계

1. **1단계 (현재 구현 범위)**
   - Mock 시세 + Mock 주문
   - 전체 전략/리스크 플로우를 검증
2. 2단계
   - Polymarket 실데이터 + Mock 주문
   - 실 시세에서 전략이 어떻게 동작하는지 관찰
3. 3단계
   - 실데이터 + 소액 실주문
   - 리스크 모듈 설정을 충분히 보수적으로 유지한 상태에서 단계적으로 진입

