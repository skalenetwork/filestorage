const PrivateKeyProvider = require("truffle-privatekey-provider");
require('dotenv').config();

module.exports = {
  networks: {
      server: {
          host: "127.0.0.1",
          port: 2234,
          gasPrice: 0,
          network_id: "*",
          provider: () => new PrivateKeyProvider(process.env.PRIVATEKEY, "http://127.0.0.1:2234")
      },
  },

  compilers: {
    solc: {
      version: "0.4.24"
    }
  }
};
