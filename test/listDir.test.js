const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");
const FileStorageManager = artifacts.require("./FileStorageManager");
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
            let dirInfo = content.find(obj => {
                return obj.name === dirName;
            });
            let fileInfo = content.find(obj => {
                return obj.name === fileName;
            });
            assert.isArray(content);
            assert.isTrue(parseInt(dirInfo.status) === 0 && dirInfo.isFile === false);
            assert.isTrue(parseInt(fileInfo.status) === 2 && fileInfo.isFile === true);
        });

        it('should list files with chunks in directory', async function () {
            let fileName = randomstring.generate();
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            let filePath = path.join(dirName, fileName);
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.startUpload(filePath, 2*CHUNK_LENGTH, {from: accounts[0]});
            await filestorage.uploadChunk(filePath, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.uploadChunk(filePath, CHUNK_LENGTH, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.finishUpload(filePath, {from: accounts[0]});
            let content = await filestorage.listDir(dirPath);
            assert.isArray(content);
            assert.isArray(content.find(obj => {
                return obj.name === fileName;
            }));
        });

        it('should list files with different statuses', async function () {
            let fileName = randomstring.generate();
            let unfinishedFileName = randomstring.generate();
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * CHUNK_LENGTH,
                charset: 'hex'
            }));
            let filePath = path.join(dirName, fileName);
            let unfinishedFilePath = path.join(dirName, unfinishedFileName);
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.startUpload(unfinishedFilePath, CHUNK_LENGTH, {from: accounts[0]});
            await filestorage.startUpload(filePath, CHUNK_LENGTH, {from: accounts[0]});
            await filestorage.uploadChunk(filePath, 0, data, {from: accounts[0], gas: UPLOADING_GAS});
            await filestorage.finishUpload(filePath, {from: accounts[0]});
            let content = await filestorage.listDir(dirPath);
            let unfinishedInfo = content.find(obj => {
                return obj.name === unfinishedFileName;
            });
            let finishedInfo = content.find(obj => {
                return obj.name === fileName;
            });
            assert.isArray(finishedInfo);
            assert.isTrue(finishedInfo.name === fileName &&
                unfinishedInfo.name === unfinishedFileName, 'Incorrect fileName');
            assert.isTrue(parseInt(finishedInfo.size) === CHUNK_LENGTH &&
                parseInt(unfinishedInfo.size) === CHUNK_LENGTH, 'Incorrect fileSize');
            assert.isTrue(parseInt(finishedInfo.status) === 2, 'Finished file: incorrect status');
            assert.isTrue(finishedInfo.isChunkUploaded.length === 1, 'Finished file: incorrect chunk length');
            assert.isTrue(finishedInfo.isChunkUploaded[0] === true, 'Finished file: incorrect chunks');
            assert.isArray(unfinishedInfo);
            assert.isTrue(parseInt(unfinishedInfo.status) === 1, 'Unfinished file: incorrect status');
            assert.isTrue(unfinishedInfo.isChunkUploaded.length === 1, 'Unfinished file: incorrect chunk length');
            assert.isTrue(unfinishedInfo.isChunkUploaded[0] === false, 'Unfinished file: incorrect chunks');
        });

        it('should list dirs in correct format', async function () {
            await filestorage.createDir(dirName, {from: accounts[0]});
            let content = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
            let dirInfo = content.find(obj => {
                return obj.name === dirName;
            });
            assert.isArray(dirInfo);
            assert.equal(dirInfo.name, dirName);
            assert.equal(dirInfo.isFile, false);
        });

        it('should list dirs and files in root directory', async function () {
            let fileName = randomstring.generate();
            await filestorage.createDir(dirName, {from: accounts[0]});
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            let content = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
            assert.isArray(content);
            assert.isArray(content.find(obj => {
                return obj.name === dirName;
            }));
            assert.isArray(content.find(obj => {
                return obj.name === fileName;
            }));
        });

        it('should return empty list from root directory', async function () {
            let content = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
            assert.isArray(content);
            assert.isEmpty(content);
        });

        // TODO: Update test for root dir
        it('should list dirs with different path format', async function () {
            // let content1 = await filestorage.listDir(rmBytesSymbol(accounts[0]));
            let content2 = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
            // let content3 = await filestorage.listDir('/' + rmBytesSymbol(accounts[0]));
            await filestorage.createDir(dirName, {from: accounts[0]});
            // let content4 = await filestorage.listDir(dirPath);
            let content5 = await filestorage.listDir(dirPath + '/');
            // assert.isArray(content1);
            assert.isArray(content2);
            // assert.isArray(content3);
            // assert.isArray(content4);
            assert.isArray(content5);
        });

        it('should fail to list unexisted dir', async function () {
            await filestorage.listDir(dirPath).should.eventually.rejectedWith('Invalid path');
        });
    });
});
