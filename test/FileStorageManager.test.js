const chai = require('chai');
const assert = chai.assert;
chai.should();
chai.use(require('chai-as-promised'));
require('dotenv').config();

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");
const FileStorageManager = artifacts.require("./FileStorageManager");

contract('Filestorage', accounts => {
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

        beforeEach(async function () {
            let filestorageMaster = await FileStorage.new({from: accounts[0]});
            filestorage = await FileStorageManager.new({from: accounts[0]});
            await filestorage.setAddress(filestorageMaster.address);
            filestorage = await FileStorage.at(filestorage.address);
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
    });
});
