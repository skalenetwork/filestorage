const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const initFilestorage = require('./utils/helper').initFilestorage;
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

    describe('readChunk', function () {
        const MAX_BLOCK_COUNT = 2 ** 15;

        let fileName;
        let fileSize;
        let storagePath;
        let data;

        before(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            fileName = randomstring.generate();
            fileSize = 3 * CHUNK_LENGTH;
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            await filestorage.setChunkSize(CHUNK_LENGTH);
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

        it('should return chunk 1000 bytes length', async function () {
            let chunkLength = 1000;
            let receivedData = await filestorage.readChunk(
                storagePath,
                0,
                chunkLength,
                {gas: UPLOADING_GAS});
            assert.isArray(receivedData);
            assert.isNotEmpty(receivedData);
            assert.equal(receivedData.length, MAX_BLOCK_COUNT);
            assert.isTrue(ensureStartsWith0x(receivedData[0]));
            let chunk = addBytesSymbol(data.concat(rmBytesSymbol(data))
                .slice(0, 2 * chunkLength + 2));
            let receivedChunk = addBytesSymbol(receivedData.map(x => rmBytesSymbol(x)).join('')
                .slice(0, 2 * chunkLength));
            assert.isTrue(receivedChunk === chunk);
        });

        it('should fail to read more than 1Mb', async function () {
            await filestorage.readChunk(storagePath, 0, CHUNK_LENGTH + 1, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('Incorrect chunk length');
        });

        it('should fail to read from unexisted file', async function () {
            let unexistedPath = path.join(rmBytesSymbol(accounts[0]), 'test.txt');
            await filestorage.readChunk(unexistedPath, 0, CHUNK_LENGTH, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('Invalid path');
        });

        it('should fail to read from unfinished file', async function () {
            let unfinishedPath = path.join(rmBytesSymbol(accounts[0]), 'test1.txt');
            await filestorage.startUpload('test1.txt', CHUNK_LENGTH, {from: accounts[0]});
            await filestorage.readChunk(unfinishedPath, 0, CHUNK_LENGTH, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('File hasn\'t been uploaded');
        });

        it('should fail to read from position >= fileSize', async function () {
            await filestorage.readChunk(storagePath, fileSize, 1, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('Incorrect chunk position');
        });

        it('should fail to read from position > fileSize - chunklength', async function () {
            await filestorage.readChunk(storagePath, fileSize - 10, 11, {gas: UPLOADING_GAS})
                .should
                .eventually
                .rejectedWith('Incorrect chunk position');
        });
    });
});
