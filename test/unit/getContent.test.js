const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const initFilestorage = require('../utils/helper').initFilestorage;

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

    describe('getFileStatus and immutable methods', function () {
        let fileName;
        let storagePath;

        beforeEach(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            fileName = randomstring.generate();
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
        });

        it('should return 0 for nonexistent file', async function () {
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

        it('should set and get immutable status of file', async function () {
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            let isImmutable = await filestorage.isImmutable(storagePath);
            assert.equal(isImmutable, false);
            await filestorage.setImmutable(fileName, {from: accounts[0]});
            isImmutable = await filestorage.isImmutable(storagePath);
            assert.equal(isImmutable, true);
            try {
                await filestorage.setImmutable(fileName, {from: accounts[0]});
                assert.fail('File was unexpectedly set in immutable status');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Content is already immutable');
            }
        });

        it('should set and get immutable status of directory', async function () {
            await filestorage.createDirectory(fileName, {from: accounts[0]});
            let isImmutable = await filestorage.isImmutable(storagePath);
            assert.equal(isImmutable, false);
            await filestorage.setImmutable(fileName, {from: accounts[0]});
            isImmutable = await filestorage.isImmutable(storagePath);
            assert.equal(isImmutable, true);
            try {
                await filestorage.setImmutable(fileName, {from: accounts[0]});
                assert.fail('Directory was unexpectedly set in immutable status');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Content is already immutable');
            }
        });
    });
});
