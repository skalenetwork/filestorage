module.exports = {
  networks: {
      server: {
          host: "127.0.0.1",
          port: 2234,
          gasPrice: 10000000000,
          network_id: "*"
      },
  },

  compilers: {
    solc: {
      version: "0.4.24"
    }
  }
};
