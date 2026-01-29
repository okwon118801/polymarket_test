import { botConfig } from "../config/tradingConfig";
import { ExecutedOrder, OrderRequest } from "./orderTypes";

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 주문 체결 지연 + 호가 갭(슬리피지) 시뮬레이션 */
export class MockOrderExecutor {
  private idCounter = 0;

  async execute(order: OrderRequest): Promise<ExecutedOrder> {
    const delayMs = botConfig.mock?.orderFillDelayMs ?? 0;
    if (delayMs > 0) await delay(delayMs);

    this.idCounter += 1;
    const slippagePct = botConfig.mock?.slippagePct ?? 0;
    const slippage = order.price * slippagePct * (Math.random() > 0.5 ? 1 : -1);
    const filledPrice = Math.max(0.01, Math.min(0.99, order.price + slippage));

    return {
      ...order,
      id: `mock-${this.idCounter}`,
      timestamp: Date.now(),
      filledPrice
    };
  }
}

