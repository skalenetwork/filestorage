const chai = require('chai');
const fs = require('fs');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const initFilestorage = require('../utils/helper').initFilestorage;
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

    describe('Download performance test', async function () {
        let fileName;
        let storagePath;
        let fileSize;

        before(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            fileName = randomstring.generate();
            storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            filePath = path.resolve(__dirname, "./image.jpg")
            imgBuffer = fs.readFileSync(filePath);
            imgHex = imgBuffer.toString('hex');
            var stats = fs.statSync(filePath)
            fileSize = stats.size;
            let ptr = 0;
            await filestorage.setChunkSize(CHUNK_LENGTH);
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0], gas: UPLOADING_GAS});
            while(ptr < 2 * fileSize) {
                finish = Math.min(ptr + 2 * CHUNK_LENGTH, 2 * fileSize + 1);
                data = addBytesSymbol(imgHex.substring(ptr, finish))
                await filestorage.uploadChunk(fileName, ptr / 2, data, {from: accounts[0], gas: UPLOADING_GAS});
                ptr = finish;
            }
            await filestorage.finishUpload(fileName, {from: accounts[0]});
        });

        let iterationsCount = 5;
        for (let i = 1; i <= iterationsCount; i++) {
            it(`Attempt ${i} to read file`, async function () {
                var i = 0;
                while (i < fileSize) {
                    let chunkLength = Math.min(CHUNK_LENGTH, fileSize - i);
                    await filestorage.readChunk(storagePath, i, chunkLength, {gas: UPLOADING_GAS});
                    i += chunkLength;
                }
            });
        }
    });

    describe('Upload performance test', async function () {
        let fileSize;
        let imgHex;

        before(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            filePath = path.resolve(__dirname, "./image.jpg")
            imgBuffer = fs.readFileSync(filePath);
            imgHex = imgBuffer.toString('hex');
            var stats = fs.statSync(filePath)
            fileSize = stats.size;
            await filestorage.setChunkSize(CHUNK_LENGTH);
        });

        let iterationsCount = 5;
        for (let i = 1; i <= iterationsCount; i++) {
            it(`Attempt ${i} to upload file`, async function () {
                let ptr = 0;
                let fileName = randomstring.generate();
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0], gas: UPLOADING_GAS});
                while(ptr < 2 * fileSize) {
                    finish = Math.min(ptr + 2 * CHUNK_LENGTH, 2 * fileSize + 1);
                    data = addBytesSymbol(imgHex.substring(ptr, finish))
                    await filestorage.uploadChunk(fileName, ptr / 2, data, {from: accounts[0], gas: UPLOADING_GAS});
                    ptr = finish;
                }
                await filestorage.finishUpload(fileName, {from: accounts[0]});
            });
        }
    });
});
