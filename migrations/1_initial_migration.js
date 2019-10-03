const Migrations = artifacts.require("Migrations");
const Filestorage = artifacts.require("FileStorage");
const getFunds = require("../test/utils/getFunds");

module.exports = function(deployer) {
    // let currentNetwork = Object.keys( deployer.networks )[0];
    // if (currentNetwork === 'skaled') {
    //     await getFunds(deployer.networks[currentNetwork].from);
    // }
    deployer.deploy(Migrations);
    deployer.deploy(Filestorage);
};
