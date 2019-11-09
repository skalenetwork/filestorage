const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const getFunds = require('./utils/helper').getFunds;
const privateKeyToAddress = require('./utils/helper').privateKeyToAddress;
const initFilestorage = require('./utils/helper').initFilestorage;
const sendTransaction = require('./utils/helper').sendTransaction;
const UPLOADING_GAS = 10 ** 8;
const CHUNK_LENGTH = 2 ** 20;

// TODO: add getFileStatus
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

    describe('createDir', function () {
        let fileName;
        let dirName;
        let filePath;
        let dirPath;
        let foreignDir;

        before(async function () {
            await getFunds(privateKeyToAddress(process.env.PRIVATEKEY));
        });

        beforeEach(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            fileName = randomstring.generate();
            dirName = randomstring.generate();
            foreignDir = 'foreignDir';
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
            assert.isArray(dir.find(obj => {
                return obj.name === nestedDirName;
            }));
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
            assert.isArray(dir.find(obj => {
                return obj.name === fileName;
            }));
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
                length: 2 * CHUNK_LENGTH,
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
                assert.equal(error.receipt.revertReason, 'File or directory exists');
            }
        });

        it('should fail to create dir and file with the same name', async function () {
            await filestorage.createDir(dirName, {from: accounts[0]});
            try {
                await filestorage.startUpload(dirName, 0, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'File or directory exists');
            }
        });

        it('should fail to create file and dir with the same name', async function () {
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            try {
                await filestorage.createDir(fileName, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'File or directory exists');
            }
        });

        it('should fail to create directory with unexisted path', async function () {
            try {
                await filestorage.createDir(path.join(fileName, dirName), {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid path');
            }
        });

        it('should fail to create file in unexisted dir', async function () {
            try {
                await filestorage.startUpload(path.join(dirName, fileName), 0, {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid path');
            }
        });

        it('should fail to create dir with \'..\' or \'.\' or \'\' name', async function () {
            try {
                await filestorage.createDir('..', {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid directory name');
            }
            try {
                await filestorage.createDir('.', {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid directory name');
            }
            try {
                await filestorage.createDir('', {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid path');
            }
        });

        it('should fail whether directory is full', async function () {
            await filestorage.setContentCount(1);
            await filestorage.startUpload(fileName, 0, {from: accounts[0]});
            try {
                await filestorage.createDir('testDir', {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Directory is full');
            }
        });

        it('should fail to create dir in foreign dir', async function () {
            let tx = filestorage.contract.methods.createDir(foreignDir);
            await sendTransaction(tx, filestorage.address, 20000000, process.env.PRIVATEKEY);
            try {
                await filestorage.createDir(path.join(foreignDir, 'dir'), {from: accounts[0]});
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid path');
            }
            tx = filestorage.contract.methods.deleteDir(foreignDir);
            await sendTransaction(tx, filestorage.address, 20000000, process.env.PRIVATEKEY);
        });
    });
});
