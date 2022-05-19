const Migrations = artifacts.require("Migrations");
const Filestorage = artifacts.require("FileStorage");
const getFunds = require("../test/utils/helper").getFunds;

module.exports = async function(deployer) {
    if (deployer.network === 'skaled') {
        await getFunds(deployer.networks[deployer.network].from);
    }
    await deployer.deploy(Migrations);
    await deployer.deploy(Filestorage);
};
