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

    describe('Download performance test', function () {
        let fileName;
        let storagePath;
        let fileSize;

        before(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            fileName = randomstring.generate();
            filePath = path.resolve(__dirname, "./image.jpg")
            imgBuffer = fs.readFileSync(filePath);
            imgHex = imgBuffer.toString('hex');
            console.log(imgHex.length / 2);
            var stats = fs.statSync(filePath)
            var fileSizeInBytes = stats.size;
            console.log(fileSizeInBytes)
            let ptr = 0;
            await filestorage.setChunkSize(CHUNK_LENGTH);
            await filestorage.startUpload(fileName, fileSizeInBytes, {from: accounts[0], gas: UPLOADING_GAS});
            while(ptr < 2 * fileSizeInBytes) {
                finish = Math.min(ptr + 2 * CHUNK_LENGTH, 2 * fileSizeInBytes + 1);
                data = addBytesSymbol(imgHex.substring(ptr, finish))
                console.log('Uploading chunk')
                await filestorage.uploadChunk(fileName, ptr / 2, data, {from: accounts[0], gas: UPLOADING_GAS});
                console.log('Chunk uploaded')
                ptr = finish;
            }
            await filestorage.finishUpload(fileName, {from: accounts[0]});
        });

        it('Attempt 1 to read file', function () {
            console.log();
        });
    });
});
