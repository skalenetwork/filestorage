const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let randomstring = require('randomstring');
let path = require('path').posix;
const initFilestorage = require('./utils/helper').initFilestorage;

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
    describe('deleteDirectory', function () {
        let dirName;
        let dirPath;

        beforeEach(async function () {
            filestorage = await initFilestorage(accounts[0], artifacts);
            dirName = randomstring.generate();
            dirPath = path.join(rmBytesSymbol(accounts[0]), dirName);
        });

        it('should delete dir from root dir', async function () {
            await filestorage.createDirectory(dirName, {from: accounts[0]});
            await filestorage.deleteDirectory(dirName, {from: accounts[0]});
            let root = await filestorage.listDirectory(rmBytesSymbol(accounts[0]) + '/');
            assert.isTrue(root.indexOf(dirName) === -1);
        });

        it('should delete dir from nested dir', async function () {
            let nestedDirName = randomstring.generate();
            await filestorage.createDirectory(dirName, {from: accounts[0]});
            await filestorage.createDirectory(path.join(dirName, nestedDirName), {from: accounts[0]});
            await filestorage.deleteDirectory(path.join(dirName, nestedDirName), {from: accounts[0]});
            let root = await filestorage.listDirectory(path.join(rmBytesSymbol(accounts[0]), dirName));
            assert.isTrue(root.indexOf(nestedDirName) === -1);
        });

        it('should fail deleting non-empty dir', async function () {
            let nestedDirName = randomstring.generate();
            await filestorage.createDirectory(dirName, {from: accounts[0]});
            await filestorage.createDirectory(path.join(dirName, nestedDirName), {from: accounts[0]});
            try {
                await filestorage.deleteDirectory(dirName, {from: accounts[0]});
                assert.fail('Directory was unexpectfully deleted');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Directory is not empty');
            }
        });

        it('should fail deleting unexisted dir', async function () {
            try {
                await filestorage.deleteDirectory(dirName, {from: accounts[0]});
                assert.fail('Directory was unexpectfully deleted');
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Invalid path');
            }
        });
    });
});
