import { ethers } from 'hardhat'

async function get_setup_values() {
  const [owner, acc1, acc2] = await ethers.getSigners();

  // Deploy heap libraries
  const max = await ethers.getContractFactory("MaxLinkedListLib");
  const maxList = await max.deploy();
  await maxList.deployed();

  const min = await ethers.getContractFactory("MinLinkedListLib");
  const minList = await min.deploy();
  await minList.deployed();

  // Deploy factory
  const Factory = await ethers.getContractFactory("Factory", {
    libraries: {
      MaxLinkedListLib: maxList.address,
      MinLinkedListLib: minList.address,
    },
  });
  const factory = await Factory.deploy(owner.address);
  await factory.deployed();

  // Deploy router
  const routerFactory = await ethers.getContractFactory("Router");
  const router = await routerFactory.deploy(factory.address);
  await router.deployed();

  await factory.setRouter(router.address);

  const token0_factory = await ethers.getContractFactory("TestERC20");
  let token0 = await token0_factory.deploy("Test Token 0", "TEST 0");
  await token0.deployed();

  const token1_factory = await ethers.getContractFactory("TestERC20");
  let token1 = await token1_factory.deploy("Test Token 1", "TEST 1");
  await token1.deployed();

  // Create the order book
  const sizeTick = 100; // decimal=3 so multiples of 0.1
  const priceTick = 10; // decimal=3 so multiples of 0.01
  await factory.createOrderBook(token0.address, token1.address, 2, 1);

  return {
    factory,
    router,
    token0,
    token1,
    owner,
    acc1,
    acc2,
    sizeTick,
    priceTick,
  };
}

export async function setup_and_deposit_in_vault_fixture() {
  const { factory, router, token0, token1, owner, acc1, acc2, sizeTick, priceTick } =
    await get_setup_values();

  await token0.mint(acc1.getAddress(), "10000000000000");
  await token0.connect(acc1).approve(router.address, "10000000000000");
  await token0.mint(acc2.getAddress(), "10000000000000");
  await token0.connect(acc2).approve(router.address, "10000000000000");

  await token1.mint(acc1.getAddress(), "10000000000000");
  await token1.connect(acc1).approve(router.address, "10000000000000");
  await token1.mint(acc2.getAddress(), "10000000000000");
  await token1.connect(acc2).approve(router.address, "10000000000000");

  return {
    factory,
    router,
    token0,
    token1,
    owner,
    acc1,
    acc2,
    sizeTick,
    priceTick,
  };
}
