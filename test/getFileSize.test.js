const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorage");
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

    function addBytesSymbol(str) {
        if (ensureStartsWith0x(str)) return str;
        return '0x' + str;
    }

    function rmBytesSymbol(str) {
        if (!ensureStartsWith0x(str)) return str;
        return str.slice(2);
    }

    describe('getFileSize', function () {
        let fileName;
        let storagePath;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            fileName = randomstring.generate();
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
        });

        it('should return size of unfinished file', async function () {
            let fileSize = 1000000;
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            let returnedSize = await filestorage.getFileSize(storagePath);
            assert.equal(returnedSize, fileSize);
        });

        it('should return size of empty file', async function () {
            let fileSize = 0;
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            let returnedSize = await filestorage.getFileSize(storagePath);
            assert.equal(returnedSize, fileSize);
        });

        it('should return size of finished file', async function () {
            let fileSize = 100;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * fileSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            let returnedSize = await filestorage.getFileSize(storagePath);
            assert.equal(returnedSize, fileSize);
        });

        it('should fail to return size of unexisted file', async function () {
            await filestorage.getFileSize(storagePath)
                .should
                .eventually
                .rejectedWith('File not found');
        });
    });
});
