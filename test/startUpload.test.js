const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");

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
        const MAX_FILENAME_LENGTH = 255;
        const MAX_FILESIZE = 10 ** 8;
        let fileName;
        let fileSize;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
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

        it('should fail while creating 2 files with the same name', async function () {
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'File or directory exists');
            }
        });

        it('should fail while creating file > 100 mb', async function () {
            fileSize = MAX_FILESIZE + 1;
            try {
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "File should be less than 100 MB");
            }
        });

        it('should fail while creating file with name > 255', async function () {
            fileName = randomstring.generate(MAX_FILENAME_LENGTH + 1);
            try {
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Filename should be < 256");
            }
        });

        it('should fail while creating file with invalid name', async function () {
            try {
                await filestorage.startUpload('', fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Filename should be < 256");
            }
            try {
                await filestorage.startUpload('.', fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Filename should be < 256");
            }
            try {
                await filestorage.startUpload('..', fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Filename should be < 256");
            }
        });

        it('should fail while creating file with invalid name in dirs', async function () {
            await filestorage.createDir('dir', {from: accounts[0]});
            try {
                await filestorage.startUpload('dir/.', fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Filename should be < 256");
            }
            try {
                await filestorage.startUpload('dir/..', fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Filename should be < 256");
            }
            await filestorage.deleteDir('dir', {from: accounts[0]});
        });

        it('should fail whether directory is full', async function () {
            await filestorage.setContentCount(1);
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            try {
                await filestorage.startUpload('testFile', 0, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Directory is full');
            }
        });

        describe('Free space limit', function () {
            let fileNames;
            let fileCount;
            let fileSize;
            beforeEach(function () {
                fileSize = MAX_FILESIZE - 1;
                fileNames = [];
                fileCount = 100;
            });

            it('should fail when storage is full', async function () {
                let i = 0;
                while (i < fileCount) {
                    fileName = randomstring.generate();
                    fileNames.push(fileName);
                    await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                    ++i;
                }
                try {
                    fileName = randomstring.generate();
                    await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                    fileNames.push(fileName);
                    assert.fail('File was unexpectfully uploaded');
                } catch (error) {
                    assert.equal(error.receipt.revertReason, "Not enough free space in the Filestorage");
                }
            });

            afterEach(async function () {
                for (let j = 0; j < fileNames.length; ++j) {
                    await filestorage.deleteFile(fileNames[j], {from: accounts[0]});
                }
            });
        });
    });
});
