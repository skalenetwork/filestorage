const chai = require('chai');
const assert = chai.assert;
chai.should();
chai.use(require('chai-as-promised'));
require('dotenv').config();

let randomstring = require('randomstring');
let path = require('path').posix;
let filestorageContract = artifacts.require('./FileStorage');
const testTotalSpace = require('../utils/helper').testSpace;

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

    describe('Predeployed test', async function () {
        let fileName;
        let fileSize;
        let foreignDir;

        before(async function () {
            filestorage = await filestorageContract.at('0xD3002000000000000000000000000000000000D3');
            let allocatorRole = await filestorage.ALLOCATOR_ROLE();
            await filestorage.grantRole(allocatorRole, accounts[0]);

            fileName = randomstring.generate();
            fileSize = Math.floor(Math.random() * 100);
            foreignDir = 'foreignDir';
        });

        it('test initial values', async function () {
            let totalSpace = await filestorage.getTotalStorageSpace();
            assert.equal(totalSpace, testTotalSpace);
            let reservedSpace = await filestorage.getTotalReservedSpace(accounts[0]);
            assert.equal(reservedSpace, 0);
        });

        it('test uploading', async function () {
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * fileSize,
                charset: 'hex'
            }));
            await filestorage.reserveSpace(accounts[0], fileSize, {from: accounts[0]});
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk(fileName, 0, data, {from: accounts[0]});
            await filestorage.finishUpload(fileName, {from: accounts[0]});

            let reservedSpace = await filestorage.getReservedSpace(accounts[0]);
            let occupiedSpace = await filestorage.getOccupiedSpace(accounts[0]);
            let storagePath = path.join(rmBytesSymbol(accounts[0]), fileName);
            let status = await filestorage.getFileStatus(storagePath);
            let size = await filestorage.getFileSize(storagePath);
            assert.equal(status, 2, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect");
            assert.equal(reservedSpace, fileSize, "reservedSpace is incorrect");
            assert.equal(occupiedSpace, fileSize, "occupiedSpace is incorrect");

            console.log(await filestorage.listDirectory(rmBytesSymbol(accounts[0])));

            await filestorage.deleteFile(fileName, {from: accounts[0]});
            await filestorage.reserveSpace(accounts[0], 0, {from: accounts[0]});
        });

        after(async function () {
            let allocatorRole = await filestorage.ALLOCATOR_ROLE();
            await filestorage.revokeRole(allocatorRole, accounts[0]);
        });
    });
});
