const chai = require('chai');
const {sendTransaction, generateAccount} = require("../utils/helper");
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

const FileStorageTest = artifacts.require("./test/FileStorageTest");

contract('Filestorage', accounts => {
    let filestorage;

    describe('Version', function () {
        it('should get version', async function () {
            filestorage = await FileStorageTest.new({from: accounts[0]});
            let version = await filestorage.version();
            assert.equal(version, '1.0.0');
        });

        it('should set version', async function () {
            filestorage = await FileStorageTest.new({from: accounts[0]});
            await filestorage.setVersion('1.0.1');
            let version = await filestorage.version();
            assert.equal(version, '1.0.1');
        });

        it('should fail to set version', async function () {
            filestorage = await FileStorageTest.new({from: accounts[0]});
            let account = await generateAccount();
            let tx = filestorage.contract.methods.setVersion('1.0.2');
            await sendTransaction(tx, filestorage.address, 20000000, account.privateKey)
                .should
                .eventually
                .rejectedWith('Caller is not the admin');
        });
    });
});
