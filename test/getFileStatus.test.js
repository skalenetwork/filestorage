const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");
const UPLOADING_GAS = 10 ** 8;
const CHUNK_LENGTH = 2 ** 20;

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

    describe('getFileStatus', function () {
        let fileName;
        let storagePath;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            fileName = randomstring.generate();
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
        });

        it('should return 0 for unexisted file', async function () {
            let status = await filestorage.getFileStatus(storagePath);
            assert.equal(status, 0);
        });

        it('should return 1 for unfinished file', async function () {
            await filestorage.startUpload(fileName, 10, {from: accounts[0]});
            let status = await filestorage.getFileStatus(storagePath);
            assert.equal(status, 1);
        });

        it('should return 2 for finished file', async function () {
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            let status = await filestorage.getFileStatus(storagePath);
            assert.equal(status, 2);
        });
    });
});
