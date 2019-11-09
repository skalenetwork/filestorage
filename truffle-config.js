const PrivateKeyProvider = require("@truffle/hdwallet-provider");
require('dotenv').config();

module.exports = {
  networks: {
      skaled: {
          gasPrice: 0,
          network_id: "*",
          provider: () => new PrivateKeyProvider(process.env.SCHAIN_OWNER_PK, process.env.ENTRYPOINT)
      },
  },

  compilers: {
    solc: {
      version: "0.4.24"
    }
  },

  mocha: {
      enableTimeouts: false
  }
};
