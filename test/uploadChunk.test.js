const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
const initFilestorage = require('./utils/helper').initFilestorage;
const UPLOADING_GAS = 10 ** 8;
const CHUNK_LENGTH = 2 ** 10;

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

    describe('uploadChunk', function () {
        let fileName;

        beforeEach(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
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
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'Chunk loaded incorrectly');
        });

        it('should upload full-size chunk', async function () {
            let fileSize = CHUNK_LENGTH + Math.floor(Math.random() * 100);
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'Chunk loaded incorrectly');
        });

        it('should upload several full-size chunks', async function () {
            let fileSize = 4 * CHUNK_LENGTH;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.uploadChunk(fileName, CHUNK_LENGTH, data, {from: accounts[0], gas: UPLOADING_GAS});
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'First chunk loaded incorrectly');
            assert.equal(fileInfo['isChunkUploaded'][1], true, 'Second chunk loaded incorrectly');
        });

        it('should upload finishing chunk in file', async function () {
            let lastChunkSize = Math.floor(Math.random() * 300);
            let fileSize = 2 * CHUNK_LENGTH + lastChunkSize;
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * lastChunkSize,
                charset: 'hex'
            }));
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 2 * CHUNK_LENGTH, data, {from: accounts[0], gas: UPLOADING_GAS});
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
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
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to upload less than full-size chunk', async function () {
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

            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], false, 'First chunk loaded incorrectly');
        });

        it('should fail to upload more than full-size chunk', async function () {
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
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
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
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
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
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
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
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
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
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
            let fileInfo = fileList.find(obj => {
                return obj.name === fileName;
            });
            assert.equal(fileInfo['isChunkUploaded'][0], true, 'First chunk loaded incorrectly');
        });

        it('should fail to upload on the position not multiple chunk length', async function () {
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
                assert.equal(error.receipt.revertReason, "Incorrect chunk position")
            }
            let fileList = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
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
                assert.equal(error.receipt.revertReason, "Incorrect chunk position")
            }
        });
    });
});
