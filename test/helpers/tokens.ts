/**
 * Helpers for interacting with real-world ERC-20 tokens on a forked network.
 */

import { BigNumberish, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { ERC20, ERC20__factory } from '../../typechain-types';
import { fundAndImpersonate } from './evm';

// Pull out certain functions that we need from the ABIs.
export const ERC1820_INTF = new ethers.utils.Interface([
  'function getInterfaceImplementer(address _addr, bytes32 _interfaceHash) external view returns (address)',
  'function setInterfaceImplementer(address _addr, bytes32 _interfaceHash, address _implementer) external',
]);
export const USDC_INTF = new ethers.utils.Interface([
  'function blacklist(address _account) external',
]);
export const USDT_INTF = new ethers.utils.Interface([
  'function owner() view returns (address)',
  'function setParams(uint256 newBasisPoints, uint256 newMaxFee) external',
]);

export const ERC1820_AMP_TOKENS_RECIPIENT = 'AmpTokensRecipient';
export const MAINNET_USDC_BLACKLISTER = '0x5dB0115f3B72d19cEa34dD697cf412Ff86dc7E1b';

export const MAINNET_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const MAINNET_USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
export const MAINNET_AMP = '0xff20817765cb7f73d4bde2e66e067e58d11095c2';
export const MAINNET_ERC1820 = '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24';

const MAINNET_WHALES: Record<string, string> = {
  [MAINNET_USDC]: '0x72A53cDBBcc1b9efa39c834A540550e23463AAcB',
  [MAINNET_USDT]: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
  [MAINNET_AMP]: '0xc880015bd3de2bf7ca6f07e8f763a8c00ed3c2c2',
}

export async function getErc20(erc20Address: string): Promise<ERC20> {
  const [defaultSigner] = await ethers.getSigners();
  return new ERC20__factory(defaultSigner).attach(erc20Address);
}

export async function fundErc20(
  erc20Address: string,
  recipientAddress: string,
  amount: BigNumberish,
): Promise<ContractTransaction> {
  const whaleAddress = MAINNET_WHALES[erc20Address];
  if (!whaleAddress) {
    throw new Error(`Unknown mainnet token`);
  }
  const whale = await fundAndImpersonate(whaleAddress);
  const erc20 = await getErc20(erc20Address)
  return erc20.connect(whale).transfer(recipientAddress, amount);
}
