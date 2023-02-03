import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish } from "ethers";
import hre, { ethers } from 'hardhat';

export async function impersonate(address: string): Promise<SignerWithAddress> {
  await ethers.provider.send('hardhat_impersonateAccount', [address])
  return hre.ethers.getSigner(address);
}

export async function fundAndImpersonate(
  address: string
): Promise<SignerWithAddress> {
  await setBalance(address, ethers.utils.parseEther('1'));
  return impersonate(address);
}


export async function setBalance(address: string, balance: BigNumberish) {
  await ethers.provider.send('hardhat_setBalance', [
    address,
    bnToBytes(balance),
  ]);
}

function bnToBytes(x: BigNumberish): string {
  const bn = BigNumber.from(x);
  if (!bn.isZero()) {
    // As hex string no padding:
    return `0x${BigNumber.from(x).toHexString().slice(2).replace(/^0*/, '')}`;
  }
  return '0x0';
}
