const chai = require('chai');
const assert = chai.assert;
chai.should();
chai.use(require('chai-as-promised'));
require('dotenv').config();

let randomstring = require('randomstring');
let path = require('path').posix;
const initFilestorage = require('./utils/helper').initFilestorage;
const sendTransaction = require('./utils/helper').sendTransaction;
const getFunds = require('./utils/helper').getFunds;

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
        let foreignDir;

        beforeEach(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            fileName = randomstring.generate();
            fileSize = Math.floor(Math.random() * 100);
            foreignDir = 'foreignDir';
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
            await filestorage.createDirectory('dir', {from: accounts[0]});
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
            await filestorage.deleteDirectory('dir', {from: accounts[0]});
        });

        it('should fail to create file in foreign dir', async function () {
            await getFunds(process.env.ADDRESS);
            await filestorage.createDirectory(foreignDir, {from: accounts[0]});
            let tx = filestorage.contract.methods.startUpload(path.join(foreignDir, fileName), 0);
            await sendTransaction(tx, filestorage.address, 20000000, process.env.PRIVATEKEY)
                .should
                .eventually
                .rejectedWith('Invalid path');
            await filestorage.deleteDirectory(foreignDir, {from: accounts[0]});
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
            beforeEach(async function () {
                await filestorage.setStorageSpace(MAX_FILESIZE);
                await filestorage.setChunkSize(2 ** 20);
                fileSize = MAX_FILESIZE - 1;
                fileNames = [];
                fileCount = 1;
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
