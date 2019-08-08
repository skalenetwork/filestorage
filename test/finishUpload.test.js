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

    describe('finishUpload', function () {
        let fileName;
        let storagePath;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            fileName = randomstring.generate();
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
        });

        it('should finish fully uploaded file', async function () {
            let fileSize = Math.floor(Math.random() * 100);
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * fileSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0]});
            try {
                await filestorage.finishUpload(fileName, {from: accounts[0]});
            } catch (e) {
                console.log(e);
            }

            let status = await filestorage.getFileStatus.call(storagePath);
            assert.equal(status, 2, 'Status is not 2');
        });

        it('should finish empty file', async function () {
            let fileSize = 0;
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.finishUpload(fileName, {from: accounts[0]});
            } catch (e) {
                console.log(e);
            }
            let status = await filestorage.getFileStatus.call(storagePath);
            assert.equal(status, 2, 'Status is not 2');
        });

        it('should fail finishing partially uploaded file', async function () {
            let fileSize = CHUNK_LENGTH + 10;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            try {
                await filestorage.finishUpload(fileName, {from: accounts[0]});
                assert.fail('File was unexpectfully finished');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "File hasn't been uploaded correctly");
            }
        });

        it('should fail finishing unexisted file', async function () {
            try {
                await filestorage.finishUpload(fileName, {from: accounts[0]});
                assert.fail('File was unexpectfully finished');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "File not found");
            }
        });

        it('should fail finishing already finished file', async function () {
            let fileSize = 0;
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            try {
                await filestorage.finishUpload(fileName, {from: accounts[0]});
                assert.fail('File was unexpectfully finished');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "File not found");
            }
        });
    });
});
