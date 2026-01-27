import { ExecutedOrder, OrderRequest } from "./orderTypes";

// 1단계: Mock 주문 실행 – 체결은 즉시, 슬리피지 없음 가정
export class MockOrderExecutor {
  private idCounter = 0;

  async execute(order: OrderRequest): Promise<ExecutedOrder> {
    this.idCounter += 1;
    return {
      ...order,
      id: `mock-${this.idCounter}`,
      timestamp: Date.now(),
      filledPrice: order.price
    };
  }
}

