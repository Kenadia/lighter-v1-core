import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { MaliciousErc1820Hook__factory } from '../typechain-types'
import { fundAndImpersonate, impersonate } from './helpers/evm'
import { setup_and_deposit_in_vault_fixture } from './helpers/fixtures'
import { createLimitOrder, createOrderBook } from './helpers/orderBook'
import { ERC1820_AMP_TOKENS_RECIPIENT, ERC1820_INTF, fundErc20, getErc20, MAINNET_AMP, MAINNET_ERC1820, MAINNET_USDC, MAINNET_USDC_BLACKLISTER, MAINNET_USDT, USDC_INTF, USDT_INTF } from './helpers/tokens'

describe('Findings', () => {
  if (!process.env.FORK) {
    console.log('Please run with FORK=true.');
    return;
  }

  /**
   * Likelihood: Low
   * Impact: Medium
   *
   * Description: Some ERC-20 tokens implement transfer hooks via standards such
   *   as ERC-1820 or ERC-777. Given the structure of your order book, this
   *   could lead to DoS (and potentially, re-entrancy attacks). There are notable
   *   high-profile instances of these types of attacks happening in the wild,
   *   and it becomes a lot more likely if order book creation is ever opened up
   *   to third-parties, e.g. via a DAO.
   *
   *   Ref: https://medium.com/amber-group/preventing-re-entrancy-attacks-lessons-from-history-c2d96480fac3
   */
  it('Order book DoS by ERC-1820 callback', async () => {
    const { factory, router, acc1, acc2, token0 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    // Fund the second account with AMP and set allowance.
    await fundErc20(MAINNET_AMP, acc2.address, '1000000');
    const amp = await getErc20(MAINNET_AMP);
    await amp.connect(acc2).approve(router.address, '1000000');

    // Create order book for AMP.
    const orderBookId = await createOrderBook(factory, token0.address, MAINNET_AMP, 2, 1);

    // Malicious user sets up an on-receive hook for AMP.
    const maliciousHook = await new MaliciousErc1820Hook__factory(acc1).deploy();
    await maliciousHook.deployed();
    const registry = await new Contract(MAINNET_ERC1820, ERC1820_INTF, acc1);
    const interfaceHash = ethers.utils.keccak256(Buffer.from(ERC1820_AMP_TOKENS_RECIPIENT));
    await registry.setInterfaceImplementer(ethers.constants.AddressZero, interfaceHash, maliciousHook.address);

    // Malicious user (acc1) creates an order to buy AMP.
    await createLimitOrder(
      router.connect(acc1),
      orderBookId,
      '1000', // amount0Base
      100, // priceBase
      true, // isAsk
    );

    // Before enabling DoS, the second user is able to sell AMP.
    await createLimitOrder(
      router.connect(acc2),
      orderBookId,
      '200',
      100,
      false,
    );

    // After enabling DoS, selling AMP is not possible at and beyond the limit price
    // set by the malicious user, rendering the order book unusable.
    await maliciousHook.setDos(true);
    await expect(
      createLimitOrder(
        router.connect(acc2),
        orderBookId,
        '200',
        100,
        false,
      ),
    ).to.be.revertedWith('Denial of service');
  });

  /**
   * Likelihood: Medium
   * Impact: Medium
   *
   * Description: USDC has a blacklist function which prevents transfers to or
   *  from certain addresses. Given how your order book is structured, if an
   *  account has an open order on a USDC-based book, and is then blacklisted,
   *  then the order book may become unusable.
   *
   *  The USDC blacklist is updated regularly.
   *
   *  Ref: https://cryptoslate.com/circle-blacklists-all-tornado-cash-eth-addresses-effectively-freezing-usdc/
   *  Ref: https://twitter.com/usdcblacklist
   */
  it('Order book DoS by USDC blacklist', async () => {
    const { factory, router, acc1, acc2, token0 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    // Fund the second account with USDC and set allowance.
    const usdc = await getErc20(MAINNET_USDC);
    await fundErc20(MAINNET_USDC, acc2.address, '1000000');
    await usdc.connect(acc2).approve(router.address, '1000000');

    // Create order book for USDC.
    const orderBookId = await createOrderBook(factory, token0.address, MAINNET_USDC, 2, 1);

    // First user creates an ask (sell token0 and buy USDC).
    await createLimitOrder(
      router.connect(acc1),
      orderBookId,
      '1000', // amount0Base
      100, // priceBase
      true, // isAsk
    );

    // Before the first user is blacklisted, the second user is able to fill the ask.
    await createLimitOrder(
      router.connect(acc2),
      orderBookId,
      '200',
      100,
      false,
    );

    // After the first user is blacklisted, making bids is not possible at and beyond the
    // limit price set by the blacklisted user.
    const blacklister = await impersonate(MAINNET_USDC_BLACKLISTER);
    await new Contract(MAINNET_USDC, USDC_INTF).connect(blacklister).blacklist(acc1.address);
    await expect(
      createLimitOrder(
        router.connect(acc2),
        orderBookId,
        '200',
        100,
        false,
      ),
    ).to.be.revertedWith('Blacklistable: account is blacklisted');
  });

  /**
   * Likelihood: Very Low
   * Impact: Medium
   *
   * Description: If the USDT fee mechanism is activated, USDT order books
   *  would stop working.
   */
  it('Order book DoS by USDT fee', async () => {
    const { factory, router, acc1, acc2, token0 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );

    // Fund the first account with USDT and set allowance.
    const usdt = await getErc20(MAINNET_USDT);
    await fundErc20(MAINNET_USDT, acc1.address, '1000000');
    await usdt.connect(acc1).approve(router.address, '1000000');

    // Create order book for USDT.
    const orderBookId = await createOrderBook(factory, token0.address, MAINNET_USDT, 2, 1);

    // Before the fee is set, users are able to use the order book normally.
    await createLimitOrder(
      router.connect(acc1),
      orderBookId,
      '1000', // amount0Base
      100, // priceBase
      false, // isAsk
    );

    // After the fee is set, placing bids is no longer possible.
    const usdtContract = await new Contract(MAINNET_USDT, USDT_INTF, ethers.provider);
    const ownerAddress = await usdtContract.owner();
    const owner = await fundAndImpersonate(ownerAddress);
    await usdtContract.connect(owner).setParams(1, 1);
    await expect(
      createLimitOrder(
        router.connect(acc1),
        orderBookId,
        '1000', // amount0Base
        100, // priceBase
        false, // isAsk
      ),
    ).to.be.revertedWith('Contract balance change does not match the received amount');
  });

  /**
   * Likelihood: Medium
   * Impact: Low–Medium
   *
   * Description: A general challenge faced by on-chain order books is that
   *  of frontrunning and MEV. One particular vulnerability of the linked-list
   *  design is that it allows frontrunners to deny other traders' instructions
   *  to place and update orders, by causing their transactions to run out of gas.
   *
   *  A practical impact of this is that market makers who want to keep orders
   *  close to the center of the book may not be able to rely on update
   *  transactions to cancel and move their orders. In this case it would be
   *  more prudent for them to submit a cancel, wait for confirmation, and
   *  then place the new order. This significantly impacts the ability of
   *  market makers to provide consistent liquidity.
   */
  it('Targeted DoS of order update', async () => {
    const { router, acc1, acc2 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );
    const orderBookId = 0;
    const amount = 1000000;

    // User 1 places an order to buy.
    const initialPrice = 10;
    const orderId = await createLimitOrder(
      router.connect(acc1),
      orderBookId,
      amount,
      initialPrice,
      false, // isAsk
    );

    // User 1 wants to update their bid to a lower price.
    const newPrice = 5;
    const hintId = await router.getMockIndexToInsert(
      orderBookId,
      amount,
      newPrice,
      false, // isAsk
    );
    const gasEstimate = await router.connect(acc1).estimateGas.updateLimitOrder(
      orderBookId,
      orderId,
      amount,
      newPrice,
      hintId,
    );

    // User 1 quadruples the gas estimate to mitigate the chance of failure
    // (for example).
    const gasLimit = gasEstimate.mul(4);

    // Malicious user or miner frontruns the transaction to insert a large number
    // of orders onto the book.
    await router.connect(acc2).createLimitOrderBatch(
      orderBookId,
      100,
      new Array(200).fill(1), // Size
      new Array(200).fill(initialPrice), // Price
      new Array(200).fill(false), // isAsk
      new Array(200).fill(1),
    );

    // When user 1 submits their transaction with their conservative gas
    // estimate, the transaction fails.
    await expect(
      router.connect(acc1).updateLimitOrder(
        orderBookId,
        orderId,
        amount,
        newPrice,
        hintId,
        { gasLimit },
      ),
    ).to.be.rejectedWith('contract call run out of gas and made the transaction revert');
  });

  /**
   * Likelihood: High
   * Impact: Low–Medium
   *
   * Description: Bids at the same price level are served in LIFO order.
   *  This creates inefficiencies since traders will be incentivized to
   *  replace their orders in order to be at the front of the queue for
   *  a given price level. This especially impacts stablecoin markets.
   */
  it('Price-time priority (e.g. FIFO) is not respected for bids', async () => {
    const { router, token0 } = await loadFixture(
      setup_and_deposit_in_vault_fixture
    );
    const [_, acc1, acc2, acc3] = await ethers.getSigners();
    const orderBookId = 0;

    // Mint and approve for third user.
    await token0.mint(acc3.getAddress(), "10000000000000");
    await token0.connect(acc3).approve(router.address, "10000000000000");

    // User 1 places an order to buy.
    await createLimitOrder(
      router.connect(acc1),
      orderBookId,
      1,
      1,
      false,
    );

    // User 2 places an order to buy.
    await createLimitOrder(
      router.connect(acc2),
      orderBookId,
      1,
      1,
      false,
    );

    const balanceBefore1 = await token0.balanceOf(acc1.address);
    const balanceBefore2 = await token0.balanceOf(acc1.address);

    // User 3 places an order to sell.
    await createLimitOrder(
      router.connect(acc3),
      orderBookId,
      1,
      1,
      true,
    );

    const balanceAfter1 = await token0.balanceOf(acc1.address);
    const balanceAfter2 = await token0.balanceOf(acc1.address);

    // User 2's order was filled, even though they placed their order after User 1.
    expect(balanceAfter1.eq(balanceBefore1)).to.equal(false);
    expect(balanceAfter2.gt(balanceBefore2)).to.equal(true);
  });
})
