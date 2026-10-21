import { HardhatUserConfig, subtask } from "hardhat/config";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import path from "path";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";

subtask(
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  async (_, { config }, runSuper) => {
    const paths = await runSuper() as Array<string>;

    return paths
      .filter((solidityFilePath: string) => {
        const relativePath = path.relative(config.paths.sources, solidityFilePath)

        return relativePath !== "test/FileStorageOld.sol";
      })
  }
);

function getCustomUrl(url: string | undefined) {
  if (url) {
    return url;
  } else {
    return "http://127.0.0.1:8545"
  }
}

function getCustomPrivateKey(privateKey: string | undefined) {
  if (privateKey) {
    return [privateKey];
  } else {
    return [];
  }
}

function getGasPrice(gasPrice: string | undefined) {
  if (gasPrice) {
    return parseInt(gasPrice, 10);
  } else {
    return "auto";
  }
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer:{
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    custom: {
      url: getCustomUrl(process.env.ENDPOINT),
      accounts: getCustomPrivateKey(process.env.PRIVATE_KEY),
      gasPrice: getGasPrice(process.env.GASPRICE)
    }
  }
};

export default config;
