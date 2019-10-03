const Migrations = artifacts.require("Migrations");
const Filestorage = artifacts.require("FileStorage");
const getFunds = require("../test/utils/getFunds");

module.exports = async function(deployer) {
    let currentNetwork = Object.keys( deployer.networks )[0];
    await getFunds(deployer.networks[currentNetwork].from);
    deployer.deploy(Migrations);
    deployer.deploy(Filestorage);
};
