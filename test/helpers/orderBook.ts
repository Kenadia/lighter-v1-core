import { BigNumberish } from "ethers";
import { ethers } from "hardhat";
import { Factory, OrderBook__factory, Router } from "../../typechain-types";

export async function createLimitOrder(
  router: Router,
  orderBookId: BigNumberish,
  amount0Base: BigNumberish,
  priceBase: BigNumberish,
  isAsk: boolean,
): Promise<number> {
  const tx = await router.createLimitOrder(
    orderBookId,
    amount0Base,
    priceBase,
    isAsk,
    await router.getMockIndexToInsert(
      orderBookId,
      amount0Base,
      priceBase,
      isAsk,
    ),
  );
  const receipt = await tx.wait();
  const events = receipt.events!;
  const parsedEvents = events.map(
    (event) => {
      try {
        const intf = new ethers.utils.Interface(OrderBook__factory.abi)
        return intf.parseLog(event)
      } catch (error) {
        return null
      }
    }
  );
  const filteredEvents = parsedEvents.filter((event) => {
    return event && event.name === 'LimitOrderCreated';
  });
  return filteredEvents[0]!.args!.id;
}

export async function createOrderBook(
  factory: Factory,
  token0: string,
  token1: string,
  logSizeTick: BigNumberish,
  logPriceTick: BigNumberish,
): Promise<number> {
  const tx = await factory.createOrderBook(token0, token1, logSizeTick, logPriceTick);
  const receipt = await tx.wait();
  const events = receipt.events!;
  return events[0].args!.orderBookId;
}
