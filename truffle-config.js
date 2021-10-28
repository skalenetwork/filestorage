const PrivateKeyProvider = require("@truffle/hdwallet-provider");
const path = require('path');
const fs = require('fs');
require('dotenv').config();

module.exports = {
  networks: {
      skaled: {
          gasPrice: 0,
          network_id: "*",
          gas: 100000000,
          provider: () => new PrivateKeyProvider(process.env.SCHAIN_OWNER_PK, process.env.ENTRYPOINT)
      },
  },

  compilers: {
    solc: {
      version: "0.5.13"
    }
  },

  mocha: {
      enableTimeouts: false
  },

  plugins: ["solidity-coverage"],

  build: function (options, callback) {
      let configPath = path.join(options.destination_directory, 'contracts', 'FileStorage.json');
      let skaledConfigPath = path.join(options.working_directory, 'test', 'utils', 'config.json');
      let filestorageBytecode = require(configPath).deployedBytecode;
      let skaledConfig = require(skaledConfigPath);
      skaledConfig.accounts['0x69362535ec535F0643cBf62D16aDeDCAf32Ee6F7'].code = filestorageBytecode;
      fs.writeFileSync(skaledConfigPath, JSON.stringify(skaledConfig, null, '\t'));
  }
};
