const chai = require('chai');
const assert = chai.assert;
chai.should();
chai.use(require('chai-as-promised'));
require('dotenv').config();

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");
const FileStorageBase = artifacts.require("./FileStorage");
const FileStorageManager = artifacts.require("./FileStorageManager");
const sendTransaction = require('./utils/helper').sendTransaction;
const privateKeyToAddress = require('./utils/helper').privateKeyToAddress;

contract('FileStorageManager', accounts => {
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

    describe('FileStorage proxy', function () {
        let fileName;
        let fileSize;

        before(async function () {
            let filestorageV1 = await FileStorage.new({from: accounts[0]});
            filestorageProxy = await FileStorageManager.new(accounts[0], {from: accounts[0]});
            await filestorageProxy.setAddress(filestorageV1.address, {from: accounts[0]});
            filestorage = await FileStorage.at(filestorageProxy.address);
            await filestorage.setStorageSpace(10**10);
            await filestorage.setContentCount(2**10);
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
            await filestorageProxy.setAddress(filestorageV2.address, {from: accounts[0]});
            let storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            let status = await filestorage.getFileStatus(storagePath);
            let size = await filestorage.getFileSize(storagePath);
            assert.equal(status, 1, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect");
        });

        it('should remove old functions', async function () {
            let filestorageV3 = await FileStorageBase.new({from: accounts[0]});
            await filestorageProxy.setAddress(filestorageV3.address, {from: accounts[0]});
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
            await filestorageProxy.setAddress(filestorageV4.address, {from: accounts[0]});
            let contentCount = 2 ** 9;
            let storageSpace = 10 ** 9;
            await filestorage.setContentCount(contentCount);
            await filestorage.setStorageSpace(storageSpace);
            assert.equal(await filestorage.getContentCount(), contentCount, 'contentCount is incorrect');
            assert.equal(await filestorage.getStorageSpace(), storageSpace, 'storageSpace is incorrect');
        });

        it('should fail to update from foreign account', async function () {
            let tx = filestorageProxy.contract.methods.setAddress('0x9eb4510ea0f286d061f76e725e5a3e3a8e3eee31');
            await sendTransaction(tx, filestorageProxy.address, 20000000, process.env.SCHAIN_OWNER_PK)
                .should
                .eventually
                .rejectedWith("Invalid sender");
        });
    });

    describe('getOwnerAddress', async function () {
        let filestorageProxy;

        before(async function () {
            filestorageProxy = await FileStorageManager.new(accounts[0], {from: accounts[0]});
        });

        it('should return schain owner', async function () {
            let result = await filestorageProxy.getOwnerAddress();
            let owner = privateKeyToAddress(process.env.SCHAIN_OWNER_PK);
            assert.equal(result, owner);
        });
    })
});
