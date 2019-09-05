const PrivateKeyProvider = require("truffle-privatekey-provider");
require('dotenv').config();

module.exports = {
  networks: {
      skaled: {
          gasPrice: 0,
          network_id: "*",
          provider: () => new PrivateKeyProvider(process.env.PRIVATEKEY, process.env.ENTRYPOINT)
      },
  },

  compilers: {
    solc: {
      version: "0.4.24"
    }
  }
};
