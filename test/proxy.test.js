const chai = require('chai');
const assert = chai.assert;
chai.should();
chai.use(require('chai-as-promised'));
require('dotenv').config();

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");
const FileStorageBase = artifacts.require("./FileStorage");
const FileStorageManager = artifacts.require("./AdminUpgradeabilityProxy");
const sendTransaction = require('./utils/helper').sendTransaction;
const generateAccount = require('./utils/helper').generateAccount;
const getFunds = require('./utils/helper').getFunds;

contract('Proxy', accounts => {
    let filestorageProxy;
    let filestorage;

    function ensureStartsWith0x(str) {
        if (str.length < 2) {
            return false;
        }
        return (str[0] === '0' && str[1] === 'x');
    }

    function rmBytesSymbol(str) {
        if (!ensureStartsWith0x(str)) return str;
        return str.slice(2);
    }

    describe('startUpload', function () {
        let fileName;
        let fileSize;

        before(async function () {
            let filestorageV1 = await FileStorage.new({from: accounts[0]});
            filestorageProxy = await FileStorageManager.new(filestorageV1.address, accounts[0], "0x", {from: accounts[0]});
            filestorage = await FileStorage.at(filestorageProxy.address);
            await filestorage.setStorageSpace(10**10);
            await filestorage.setContentCount(2**10);
            await filestorage.reserveSpaceStub(accounts[0], 10**9);
            fileName = randomstring.generate();
            fileSize = Math.floor(Math.random() * 100);
        });

        it('should create file with 1 status', async function () {
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            let storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            let status = await filestorage.getFileStatus(storagePath);
            let size = await filestorage.getFileSize(storagePath);
            assert.equal(status, 1, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect");
        });

        it('should save storage for new FS instance', async function () {
            let filestorageV2 = await FileStorage.new({from: accounts[0]});
            await filestorageProxy.upgradeTo(filestorageV2.address, {from: accounts[0]});
            let storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            let status = await filestorage.getFileStatus(storagePath);
            let size = await filestorage.getFileSize(storagePath);
            assert.equal(status, 1, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect");
        });

        it('should remove old functions', async function () {
            let filestorageV3 = await FileStorageBase.new({from: accounts[0]});
            await filestorageProxy.upgradeTo(filestorageV3.address, {from: accounts[0]});
            await filestorage.setStorageSpace(10 ** 9)
                .should
                .eventually
                .rejectedWith();
            await filestorage.setContentCount(2 ** 9)
                .should
                .eventually
                .rejectedWith();
        });

        it('should add new functions', async function () {
            let filestorageV4 = await FileStorage.new({from: accounts[0]});
            await filestorageProxy.upgradeTo(filestorageV4.address, {from: accounts[0]});
            let contentCount = 2 ** 9;
            let storageSpace = 10 ** 9;
            await filestorage.setContentCount(contentCount);
            await filestorage.setStorageSpace(storageSpace);
            assert.equal(await filestorage.getContentCount(), contentCount, 'contentCount is incorrect');
            assert.equal(await filestorage.getStorageSpace(), storageSpace, 'storageSpace is incorrect');
        });

        it('should fail to update from foreign account', async function () {
            let account = await generateAccount();
            await getFunds(account.address);
            let tx = filestorageProxy.contract.methods.upgradeTo(account.address);
            await sendTransaction(tx, filestorageProxy.address, 20000000, account.privateKey)
                .should
                .eventually
                .rejectedWith("Invalid sender");
        });
    });
});