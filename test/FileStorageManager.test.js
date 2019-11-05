const chai = require('chai');
const assert = chai.assert;
chai.should();
chai.use(require('chai-as-promised'));
require('dotenv').config();

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");
const FileStorageManager = artifacts.require("./FileStorageManager");

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

    describe('startUpload', function () {
        let fileName;
        let fileSize;

        before(async function () {
            let filestorageV1 = await FileStorage.new({from: accounts[0]});
            filestorageProxy = await FileStorageManager.new({from: accounts[0]});
            await filestorageProxy.setAddress(filestorageV1.address);
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
            assert.equal(size, fileSize, "Size is incorrect")
        });

        it('should save storage for new FS instance', async function () {
            let filestorageV2 = await FileStorage.new({from: accounts[0]});
            await filestorageProxy.setAddress(filestorageV2.address);
            let storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            let status = await filestorage.getFileStatus(storagePath);
            let size = await filestorage.getFileSize(storagePath);
            assert.equal(status, 1, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect")
        });
    });
});
