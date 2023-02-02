import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";
import { HardhatNetworkUserConfig, HttpNetworkUserConfig } from "hardhat/types";

// Throw-away key.
const ALCHEMY_KEY = 'asKzBAStzKF-PeLfUIXc2zpj0kf7vM1a'

function getHardhatConfig() {
  const networkConfig: HardhatNetworkUserConfig = {
    allowUnlimitedContractSize: true,
  };

  // Fork ETH mainnet.
  if (process.env.FORK) {
    networkConfig.chainId = 1;
    networkConfig.forking = {
      url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    };
    (networkConfig as HttpNetworkUserConfig).timeout = 0;
  }
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  networks: {
    hardhat: getHardhatConfig(),
  },
};

export default config;
