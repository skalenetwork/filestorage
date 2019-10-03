const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const FileStorage = artifacts.require("./FileStorageTest");
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

    // TODO: delete file first, dir - remain and vice versa
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
            let root = await filestorage.listDir(rmBytesSymbol(accounts[0]) + '/');
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
});
