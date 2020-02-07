const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const initFilestorage = require('./utils/helper').initFilestorage;

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

    describe('deleteFile', function () {
        let fileName;
        let storagePath;

        beforeEach(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            fileName = randomstring.generate();
            let fileSize = Math.floor(Math.random() * 100);
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
        });

        it('should delete unfinished file', async function () {
            await filestorage.deleteFile(fileName, {from: accounts[0]});
            let status = await filestorage.getFileStatus.call(storagePath);
            assert.equal(status, 0);
        });

        it('should delete finished file', async function () {
            fileName = randomstring.generate();
            let fileSize = 0;
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            await filestorage.deleteFile(fileName, {from: accounts[0]});
            let status = await filestorage.getFileStatus.call(storagePath);
            assert.equal(status, 0);
        });

        it('should fail deleting nonexistent file', async function () {
            fileName = randomstring.generate();
            try {
                await filestorage.deleteFile(fileName, {from: accounts[0]});
                assert.fail('File was unexpectedly deleted');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid path');
            }
        });
    });
});
