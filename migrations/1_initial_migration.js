const Migrations = artifacts.require("Migrations");
const Filestorage = artifacts.require("FileStorage");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
  deployer.deploy(Filestorage);
};
