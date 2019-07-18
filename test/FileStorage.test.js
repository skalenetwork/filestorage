const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
const FileStorage = artifacts.require("./FileStorage");

contract('Filestorage', accounts => {
    let filestorage;

    function ensureStartsWith0x(str) {
        if (str.length < 2) {return false;}
        return (str[0] === '0' && str[1] === 'x');
    }

    function rmBytesSymbol(str){
        if (!ensureStartsWith0x(str)) return str;
        return str.slice(2);
    }

    describe('startUpload', function () {
        let fileName;
        let fileSize;

        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            fileName = randomstring.generate();
            fileSize = Math.floor(Math.random()*100);
        });

        it('should create file with 1 status', async function () {
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            let storagePath = path.posix.join(rmBytesSymbol(accounts[0]), fileName);
            let status = await filestorage.getFileStatus.call(storagePath);
            let size = await filestorage.getFileSize.call(storagePath);
            assert.equal(status, 1, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect")
        });

        it('should fail while creating 2 files with the same name', async function () {
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            try{
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error['receipt']['revertReason'], "File already exists");
            }
        });

        it('should fail while creating file > 100 mb', async function () {
            fileSize = 10 ** 8 + 1;
            try{
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error['receipt']['revertReason'], "File should be less than 100 MB");
            }
        });

        it('should fail while creating file with name > 256', async function () {
            fileName = randomstring.generate(257);
            try{
                await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error['receipt']['revertReason'], "Filename should be <= 256 and not contains '/'");
            }
        });

        describe('Free space limit', function(){
            let fileNames;
            let fileCount;
            before(function(){
                fileSize = 10 ** 8 - 1;
                fileNames = [];
                fileCount = 10;
            });

            it('should fail when storage is full', async function () {
                let i = 0;
                while(i < fileCount){
                    fileName = randomstring.generate();
                    fileNames.push(fileName);
                    await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                    ++i;
                }
                try{
                    fileName = randomstring.generate();
                    await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
                    fileNames.push(fileName);
                    assert.fail('File was unexpectfully uploaded');
                } catch (error) {
                    assert.equal(error['receipt']['revertReason'], "Not enough free space in the Filestorage");
                }
            });

            afterEach(async function(){
                for (let j = 0; j < fileNames.length; ++j){
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
            let fileSize = Math.floor(Math.random()*100);
            storagePath = path.posix.join(rmBytesSymbol(accounts[0]), fileName);
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
        });

        it('should delete unfinished file', async function () {
            await filestorage.deleteFile(fileName, {from: accounts[0]});
            let status = await filestorage.getFileStatus(storagePath);
            assert.equal(status, 0);
        });

        it('should delete finished file', async function(){
            fileName = randomstring.generate();
            let fileSize = 0;
            storagePath = path.posix.join(rmBytesSymbol(accounts[0]), fileName);
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});
            await filestorage.deleteFile(fileName, {from: accounts[0]});
            let status = await filestorage.getFileStatus(storagePath);
            assert.equal(status, 0);
        });

        it('should fail deleting unexisted file', async function(){
            fileName = randomstring.generate();
            try {
                await filestorage.deleteFile(fileName, {from: accounts[0]});
                assert.fail('File was unexpectfully uploaded');
            } catch (error) {
                assert.equal(error['receipt']['revertReason'], "File not exists");
            }
        });
    });

    describe('finishUpload', function () {
        it('should finish fully uploaded file', function () {

        });

        it('should finish empty file', function () {

        });

        it('should fail finishing partially uploaded file', function () {

        });

        it('should fail finishing unexisted file', function () {

        });

        it('should fail finishing already finished file', function () {

        });
    })
});
