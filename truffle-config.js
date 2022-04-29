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
          provider: () => new PrivateKeyProvider(process.env.SCHAIN_OWNER_PK, process.env.ENTRYPOINT),
          networkCheckTimeout: 20000
      },
  },

  compilers: {
    solc: {
      version: "0.8.9"
    }
  },

  mocha: {
      enableTimeouts: false
  },

  plugins: ["solidity-coverage"]
};
