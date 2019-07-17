
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

const FileStorage = artifacts.require("./FileStorage");

contract("Filestorage", accounts => {
    let filestorage;
    beforeEach(async function () {
        filestorage = await FileStorage.new({from: accounts[0]});
    });

    // it('should startUploading', async function () {
    //     await filestorage.startUpload("aaa.txt", 10, {from: accounts[0]});
    //     await filestorage.getFileStatus.call(accounts[0]+'/'+"aaaaa.txt")
    //         .should.eventually
    //         .rejectedWith('EVM revert instruction without description message');
    //     // assert.equal(status, 1);
    // });
});
