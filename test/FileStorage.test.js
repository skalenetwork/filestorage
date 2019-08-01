const chai = require('chai');
const expect = chai.expect;
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

    describe('startUpload', function () {
        const MAX_FILENAME_LENGTH = 256;
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
            let status = await filestorage.getFileStatus.call(storagePath);
            let size = await filestorage.getFileSize.call(storagePath);
            assert.equal(status, 1, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect")
        });

        it('should fail while creating 2 files with the same name', async function () {
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "File already exists");
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

        it('should fail while creating file with name > 256', async function () {
            fileName = randomstring.generate(MAX_FILENAME_LENGTH + 1);
            try {
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Filename should be <= 256 and not contains '/'");
            }
        });

        describe('Free space limit', function () {
            let fileNames;
            let fileCount;
            before(function () {
                fileSize = MAX_FILESIZE - 1;
                fileNames = [];
                fileCount = 10;
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

    describe('deleteFile', function () {
        let fileName;
        let storagePath;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
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

        it('should fail deleting unexisted file', async function () {
            fileName = randomstring.generate();
            try {
                await filestorage.deleteFile(fileName, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error.receipt.revertReason, "File not exists");
            }
        });
    });

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
            await filestorage.finishUpload(fileName, {from: accounts[0]});

            let status = await filestorage.getFileStatus.call(storagePath);
            assert.equal(status, 2, 'Status is not 2');
        });

        it('should finish empty file', async function () {
            let fileSize = 0;
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
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

    describe('uploadChunk', function () {
        let fileName;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            fileName = randomstring.generate();
        });

        it('should upload chunk in empty file', async function () {
            let fileSize = Math.floor(Math.random() * 100);
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * fileSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'Chunk loaded incorrectly');
        });

        it('should upload 1MB chunk', async function () {
            let fileSize = CHUNK_LENGTH + Math.floor(Math.random() * 100);
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'Chunk loaded incorrectly');
        });

        it('should upload several 1MB chunks', async function () {
            let fileSize = 2 ** 22;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.uploadChunk(fileName, CHUNK_LENGTH, data, {from: accounts[0], gas: UPLOADING_GAS});
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'First chunk loaded incorrectly');
            assert.equal(fileInfo['isChunkUploaded'][1], true, 'Second chunk loaded incorrectly');
        });

        it('should upload finishing chunk in file', async function () {
            let lastChunkSize = Math.floor(Math.random() * 300);
            let fileSize = 2 ** 21 + lastChunkSize;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * lastChunkSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 2 ** 21, data, {from: accounts[0], gas: UPLOADING_GAS});
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][2], true, 'First chunk loaded incorrectly');
        });

        it('should fail to upload chunk more than file length', async function () {
            let fileSize = 10;
            let chunkSize = 100;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * chunkSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Incorrect chunk length");
            }
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to upload less than 1MB chunk', async function () {
            let fileSize = 2 ** 21;
            let chunkSize = Math.floor(Math.random() * 100);
            let data = addBytesSymbol(randomstring.generate({
                length: chunkSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Incorrect chunk length");
            }

            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to upload more than 1MB chunk', async function () {
            let fileSize = 2 ** 21;
            let chunkSize = CHUNK_LENGTH + 1;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * chunkSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Incorrect chunk length");
            }
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to upload finish chunk of incorrect size', async function () {
            let lastChunkSize = 100;
            let fileSize = 2 ** 21 + lastChunkSize;
            let data = addBytesSymbol(randomstring.generate({
                length: 10,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Incorrect chunk length");
            }
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'Last chunk loaded incorrectly');
        });

        it('should fail to upload incorrect bytes', async function () {
            let fileSize = Math.floor(Math.random() * 1000);
            let data = addBytesSymbol(randomstring.generate({
                length: fileSize,
                charset: 'alphabetic'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('invalid bytes value');
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to upload bytes without 0x', async function () {
            let fileSize = Math.floor(Math.random() * 1000);
            let data = randomstring.generate({
                length: fileSize,
                charset: 'hex'
            });
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('invalid bytes value');
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to reupload chunk', async function () {
            let fileSize = 1000;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * fileSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            try {
                await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Chunk is already uploaded')
            }
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'First chunk loaded incorrectly');
        });

        it('should fail to upload on the position not multiple 2^20', async function () {
            let fileSize = CHUNK_LENGTH;
            let data = addBytesSymbol(randomstring.generate({
                length: 100,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.uploadChunk(fileName, 100, data, {from: accounts[0], gas: UPLOADING_GAS});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Incorrect position of chunk")
            }
            let fileList = await filestorage.getFileInfoList(rmBytesSymbol(accounts[0]));
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to upload on the position more than fileSize', async function () {
            let fileSize = CHUNK_LENGTH;
            let data = addBytesSymbol(randomstring.generate({
                length: 100,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try {
                await filestorage.uploadChunk(fileName, fileSize, data, {from: accounts[0], gas: UPLOADING_GAS});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Incorrect position of chunk")
            }
        });
    });

    describe('readChunk', function () {
        const MAX_BLOCK_COUNT = 2 ** 15;

        let fileName;
        let fileSize;
        let storagePath;
        let data;

        before(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            fileName = randomstring.generate();
            fileSize = 3 * CHUNK_LENGTH;
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.uploadChunk(fileName, CHUNK_LENGTH, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.uploadChunk(fileName, 2 * CHUNK_LENGTH, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
        });

        it('should return splitted data string', async function () {
            let receivedData = await filestorage.readChunk(storagePath, 0, CHUNK_LENGTH, {gas: UPLOADING_GAS});
            assert.isArray(receivedData);
            assert.isNotEmpty(receivedData);
            assert.equal(receivedData.length, MAX_BLOCK_COUNT);
            assert.isTrue(ensureStartsWith0x(receivedData[0]));
            assert.equal(data, addBytesSymbol(receivedData.map(x => rmBytesSymbol(x)).join('')));
        });

        it('should return chunk from position < fileSize', async function () {
            let receivedData = await filestorage.readChunk(storagePath, CHUNK_LENGTH / 2, CHUNK_LENGTH, {gas: UPLOADING_GAS});
            assert.isArray(receivedData);
            assert.isNotEmpty(receivedData);
            assert.equal(receivedData.length, MAX_BLOCK_COUNT);
            assert.isTrue(ensureStartsWith0x(receivedData[0]));
            let chunk = addBytesSymbol(data.concat(rmBytesSymbol(data)).slice(CHUNK_LENGTH + 2, 3 * CHUNK_LENGTH + 2));
            let receivedChunk = addBytesSymbol(receivedData.map(x => rmBytesSymbol(x)).join(''));
            assert.isTrue(receivedChunk === chunk);
        });

        it('should return chunk of length < 1MB', async function () {
            let chunkLength = 100;
            let receivedData = await filestorage.readChunk(
                storagePath,
                CHUNK_LENGTH / 2,
                chunkLength,
                {gas: UPLOADING_GAS});
            assert.isArray(receivedData);
            assert.isNotEmpty(receivedData);
            assert.equal(receivedData.length, MAX_BLOCK_COUNT);
            assert.isTrue(ensureStartsWith0x(receivedData[0]));
            let chunk = addBytesSymbol(data.concat(rmBytesSymbol(data))
                .slice(CHUNK_LENGTH + 2, CHUNK_LENGTH + 2 * chunkLength + 2));
            let receivedChunk = addBytesSymbol(receivedData.map(x => rmBytesSymbol(x)).join('')
                .slice(0, 2 * chunkLength));
            assert.isTrue(receivedChunk === chunk);
        });

        it('should fail to read more than 1Mb', async function () {
            await filestorage.readChunk(storagePath, 0, CHUNK_LENGTH + 1, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('EVM revert instruction without description message');
        });

        it('should fail to read from unexisted file', async function () {
            let unexistedPath = path.join(rmBytesSymbol(accounts[0]), 'test.txt');
            await filestorage.readChunk(unexistedPath, 0, CHUNK_LENGTH, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('EVM revert instruction without description message');
        });

        it('should fail to read from unfinished file', async function () {
            let unfinishedPath = path.join(rmBytesSymbol(accounts[0]), 'test1.txt');
            await filestorage.startUpload('test1.txt', CHUNK_LENGTH, {from: accounts[0]});
            await filestorage.readChunk(unfinishedPath, 0, CHUNK_LENGTH, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('EVM revert instruction without description message');
        });

        it('should fail to read from position >= fileSize', async function () {
            await filestorage.readChunk(storagePath, fileSize, 1, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('EVM revert instruction without description message');
        });

        it('should fail to read from position > fileSize - chunklength', async function () {
            await filestorage.readChunk(storagePath, fileSize - 10, 11, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('EVM revert instruction without description message');
        });
    });

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

        it('should return 1 for unexisted file', async function () {
            await filestorage.startUpload(fileName, 10, {from: accounts[0]});
            let status = await filestorage.getFileStatus(storagePath);
            assert.equal(status, 1);
        });

        it('should return 2 for unexisted file', async function () {
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            let status = await filestorage.getFileStatus(storagePath);
            assert.equal(status, 2);
        });
    });

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
                .rejectedWith('EVM revert instruction without description message');
        });
    });

    describe('createDir', function () {
        let fileName;
        let dirName;
        let filePath;
        let dirPath;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            fileName = randomstring.generate();
            dirName = randomstring.generate();
            filePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            dirPath = path.join(rmBytesSymbol(accounts[0]), dirName);
        });

        it('should create empty dir in root', async function () {
            await filestorage.createDir(dirName, {from: accounts[0]});
            let dir = await filestorage.listDir(dirPath);
            assert.isArray(dir);
        });

        it('should create empty dir in nested dir', async function () {
            let nestedDirName = randomstring.generate();
            let nestedDirPath = path.join(rmBytesSymbol(accounts[0]), dirName, nestedDirName);
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.createDir(path.join(dirName, nestedDirName), {from: accounts[0]});
            let dir = await filestorage.listDir(dirPath);
            let nestedDir = await filestorage.listDir(nestedDirPath);
            assert.isArray(dir);
            assert.isNotEmpty(dir);
            assert.isTrue(dir.indexOf(nestedDirName) > -1);
            assert.isArray(nestedDir);
        });

        it('should create file in dir', async function () {
            let fileSize = 100;
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.startUpload(path.join(dirName, fileName), 100, {from: accounts[0]});
            let status = await filestorage.getFileStatus(path.join(dirPath, fileName));
            let size = await filestorage.getFileSize(path.join(dirPath, fileName));
            let dir = await filestorage.listDir(dirPath);
            assert.equal(status, 1);
            assert.equal(size, fileSize);
            assert.isTrue(dir.indexOf(fileName) > -1);
        });

        it('should delete file from dir', async function () {
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.startUpload(path.join(dirName, fileName), 0, {from: accounts[0]});
            await filestorage.finishUpload(path.join(dirName, fileName), {from: accounts[0]});
            await filestorage.deleteFile(path.join(dirName, fileName), {from: accounts[0]});
            let status = await filestorage.getFileStatus(path.join(dirPath, fileName));
            let dir = await filestorage.listDir(dirPath);
            assert.equal(status, 0);
            assert.equal(dir.indexOf(fileName), -1);
        });

        it('should readChunk from file in dir', async function () {
            let data = addBytesSymbol(randomstring.generate({
                length: 2*CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.startUpload(path.join(dirName, fileName), CHUNK_LENGTH, {from: accounts[0]});
            await filestorage.uploadChunk(path.join(dirName, fileName),
                0, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.finishUpload(path.join(dirName, fileName), {from: accounts[0]});
            let receivedData = await filestorage.readChunk(path.join(dirPath, fileName),
                0, CHUNK_LENGTH, {gas: UPLOADING_GAS});
            assert.equal(data, addBytesSymbol(receivedData.map(x => rmBytesSymbol(x)).join('')));
        });

        it('should fail to create dirs with the same name', async function () {
            await filestorage.createDir(dirName, {from: accounts[0]});
            try {
                await filestorage.createDir(dirName, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'EVM revert instruction without description message');
            }
        });

        it('should fail to create dir and file with the same name', async function () {
            await filestorage.createDir(dirName, {from: accounts[0]});
            try {
                await filestorage.startUpload(dirName, 0, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Incorrect file path');
            }
        });

        it('should fail to create file and dir with the same name', async function () {
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            try {
                await filestorage.createDir(fileName, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'EVM revert instruction without description message');
            }
        });

        it('should fail to create directory with unexisted path', async function () {
            try {
                await filestorage.createDir(path.join(fileName, dirName), {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'EVM revert instruction without description message');
            }
        });

        it('should fail to create file in unexisted dir', async function () {
            try {
                await filestorage.startUpload(path.join(dirName, fileName), 0, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Incorrect file path');
            }
        });

        it('should fail to create dir with \'..\' or \'.\' or \'\' name', async function () {
            try {
                await filestorage.createDir('..', {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'EVM revert instruction without description message');
            }
            try {
                await filestorage.createDir('.', {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'EVM revert instruction without description message');
            }
            try {
                await filestorage.createDir('', {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'EVM revert instruction without description message');
            }
        });
    });

    describe('deleteDir', function () {
        let dirName;
        let dirPath;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            dirName = randomstring.generate();
            dirPath = path.join(rmBytesSymbol(accounts[0]), dirName);
        });

        it('should delete dir from root dir', async function () {
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.deleteDir(dirName, {from: accounts[0]});
            let root = await filestorage.listDir(rmBytesSymbol(accounts[0])+'/');
            assert.isTrue(root.indexOf(dirName) === -1);
        });

        it('should delete dir from nested dir', async function () {
            let nestedDirName = randomstring.generate();
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.createDir(path.join(dirName, nestedDirName), {from: accounts[0]});
            await filestorage.deleteDir(path.join(dirName, nestedDirName), {from: accounts[0]});
            let root = await filestorage.listDir(path.join(rmBytesSymbol(accounts[0]), dirName));
            assert.isTrue(root.indexOf(nestedDirName) === -1);
        });

        it('should fail deleting non-empty dir', async function () {
            let nestedDirName = randomstring.generate();
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.createDir(path.join(dirName, nestedDirName), {from: accounts[0]});
            try {
                await filestorage.deleteDir(dirName, {from: accounts[0]});
                assert.fail('Directory was unexpectfully deleted');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Directory is not empty');
            }
        });

        it('should fail deleting unexisted dir', async function () {
            try {
                await filestorage.deleteDir(dirName, {from: accounts[0]});
                assert.fail('Directory was unexpectfully deleted');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid path');
            }
        });
    });

    describe('listDir', function () {
        let dirName;
        let dirPath;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            dirName = randomstring.generate();
            dirPath = path.join(rmBytesSymbol(accounts[0]), dirName);
        });

        it('should list dirs and files in directory', async function () {
            let fileName = randomstring.generate();
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.createDir(path.join(dirName, dirName), {from: accounts[0]});
            await filestorage.startUpload(path.join(dirName, fileName), 0, {from: accounts[0]});
            await filestorage.finishUpload(path.join(dirName, fileName), {from: accounts[0]});
            let content = await filestorage.listDir(dirPath);
            assert.isArray(content);
            assert.isTrue(content.indexOf(dirName) > -1);
            assert.isTrue(content.indexOf(fileName) > -1);
        });

        it('should list dirs and files in root directory', async function () {
            let fileName = randomstring.generate();
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            let content = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
            assert.isArray(content);
            assert.isTrue(content.indexOf(dirName) > -1);
            assert.isTrue(content.indexOf(fileName) > -1);
        });

        it('should return empty list from root directory', async function () {
            let content = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
            assert.isArray(content);
            assert.isEmpty(content);
        });

        it('should list dirs with different path format', async function () {
            let content1 = await filestorage.listDir(rmBytesSymbol(accounts[0]));
            let content2 = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
            let content3 = await filestorage.listDir('/' + rmBytesSymbol(accounts[0]));
            await filestorage.createDir(dirName, {from: accounts[0]});
            let content4 = await filestorage.listDir(dirPath);
            let content5 = await filestorage.listDir(dirPath + '/');
            assert.isArray(content1);
            assert.isArray(content2);
            assert.isArray(content3);
            assert.isArray(content4);
        });

        it('should fail to list unexisted dir', async function () {
            await filestorage.listDir(dirPath).should.eventually.rejectedWith('Invalid path');
        });
    });
});
