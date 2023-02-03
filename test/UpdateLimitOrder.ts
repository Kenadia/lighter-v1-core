import { expect } from 'chai'
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { setup_and_deposit_in_vault_fixture } from './helpers/fixtures';

describe("Update limit order function", function () {

  it("Should update and then update sorted orders", async function () {
    const { router, acc1, token0, sizeTick } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    const startBalance = BigInt((await token0.balanceOf(acc1.address)).toString());

    // 2
    await router.connect(acc1).createLimitOrder(0, 2, 1, true, 0);
    // 3
    await router.connect(acc1).createLimitOrder(0, 3, 1, true, 0);

    // assert ids are correct
    const orders = await router.getLimitOrders(0);
    expect([2, 3]).to.eql(orders[0]);

    // assert balances are correct
    expect(
      (await token0.balanceOf(acc1.address)).eq(
        startBalance - BigInt(5) * BigInt(sizeTick)
      )
    ).to.be.true;

    await router.connect(acc1).updateLimitOrder(0, 2, 700, 100, 0);

    const updated_orders = await router.getLimitOrders(0);

    // assert updated orders are correct
    expect([3, 4]).to.eql(updated_orders[0]);
    expect(updated_orders[2][1]).to.equal(700 * sizeTick);
    expect(
      (await token0.balanceOf(acc1.address)).eq(
        startBalance - BigInt(703) * BigInt(sizeTick)
      )
    ).to.be.true;
  });

  it("Should fill order and erase if fully filled", async function () {
    const { router, acc1 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    // 2
    await router.connect(acc1).createLimitOrder(0, 1, 10, true, 0);
    // 3
    await router.connect(acc1).createLimitOrder(0, 10, 1, false, 0);

    await router.connect(acc1).updateLimitOrder(0, 2, 10, 1, 2);

    const orders = await router.getLimitOrders(0);
    expect([]).to.eql(orders[0]);
  });

  it("Should fill order and update linked list if not fully filled", async function () {
    const { router, acc1, sizeTick } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    // 2
    await router.connect(acc1).createLimitOrder(0, 1, 1, false, 0);
    // 3
    await router.connect(acc1).createLimitOrder(0, 2, 2, false, 0);
    // 4

    await router.connect(acc1).createLimitOrder(0, 1, 3, true, 0); // a0: 100, a1: 30

    const orders = await router.getLimitOrders(0);
    expect([4, 3, 2]).to.eql(orders[0]);

    await router.connect(acc1).updateLimitOrder(0, 3, 2, 3, 2); // a0: 200, a1: 60
    const updated_orders = await router.getLimitOrders(0);
    expect([5, 2]).to.eql(updated_orders[0]);
    // Order should be partially filled by ask order 4.
    const partially_filled_order_amount_0 = updated_orders[2][0];
    const partially_filled_order_amount_1 = updated_orders[3][0];
    expect(partially_filled_order_amount_0).to.equal(1 * sizeTick);
    expect(partially_filled_order_amount_1).to.equal(3);
  });

  it("Should not allow updating another user's order", async function () {
    const { router, acc1, acc2 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    async function try_to_update() {
      await router.connect(acc1).createLimitOrder(0, 7, 3, false, 0);
      await router.connect(acc2).updateLimitOrder(0, 2, 1, 1, 0);
    }

    await expect(try_to_update()).to.be.rejectedWith(
      "The caller should be the owner of the order"
    );
  });

  it("Should not allow updating a canceled order", async function () {
    const { router, acc1, acc2 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    await router.connect(acc1).createLimitOrder(0, 7, 3, false, 0);
    await router.connect(acc1).cancelLimitOrder(0, 2);
    await router.connect(acc2).updateLimitOrder(0, 2, 1, 1, 0);

    const orders = await router.getLimitOrders(0);
    expect([]).to.eql(orders[0]);
  });
});
