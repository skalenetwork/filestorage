const chai = require('chai');
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
            assert.isArray(content);
            assert.isArray(content.find(obj => {
                return obj.name === dirName;
            }));
            assert.isArray(content.find(obj => {
                return obj.name === fileName;
            }));
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
