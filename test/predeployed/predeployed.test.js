const chai = require('chai');
const assert = chai.assert;
chai.should();
chai.use(require('chai-as-promised'));
require('dotenv').config();

let randomstring = require('randomstring');
let path = require('path').posix;
let filestorageContract = artifacts.require('./FileStorage');

const testTotalSpace = require('../utils/helper').testSpace;
const fileSystemBlock = require('../utils/helper').fileSystemBlock;
const FILESTORAGE_PROXY_ADDRESS = '0xD3002000000000000000000000000000000000d3';

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

    function addBytesSymbol(str) {
        if (ensureStartsWith0x(str)) return str;
        return '0x' + str;
    }

    describe('Predeployed test', async function () {
        let fileName;
        let fileSize;
        let foreignDir;

        before(async function () {
            filestorage = await filestorageContract.at(FILESTORAGE_PROXY_ADDRESS);
            let allocatorRole = await filestorage.ALLOCATOR_ROLE();
            await filestorage.grantRole(allocatorRole, accounts[0]);

            fileName = randomstring.generate();
            fileSize = Math.floor(Math.random() * 30);
            foreignDir = 'foreignDir';
        });

        it('test roles', async function () {
            let adminRole = await filestorage.DEFAULT_ADMIN_ROLE();
            assert.equal(await filestorage.getRoleMember(adminRole, 0), accounts[0]);
            assert.equal(await filestorage.getRoleMemberCount(adminRole), 1);
            assert.isTrue(await filestorage.hasRole(adminRole, accounts[0]));
        });

        it('test initial values', async function () {
            let totalSpace = await filestorage.getTotalStorageSpace();
            assert.equal(totalSpace, testTotalSpace);
            let reservedSpace = await filestorage.getTotalReservedSpace(accounts[0]);
            assert.equal(reservedSpace, 0);
            let maxContentCount = await  filestorage.getMaxContentCount();
            assert.equal(maxContentCount, 2 ** 13);
            let maxChunkSize = await  filestorage.getMaxChunkSize();
            assert.equal(maxChunkSize, 2 ** 20);
        });


        it('full pipeline test', async function () {
            let data = addBytesSymbol(randomstring.generate({
                length: 2 * fileSize,
                charset: 'hex'
            }));
            await filestorage.reserveSpace(accounts[0], 3 * fileSystemBlock, {from: accounts[0]});
            await filestorage.createDirectory('test', {from: accounts[0]});
            await filestorage.startUpload('test/'+fileName, fileSize, {from: accounts[0]});
            await filestorage.uploadChunk('test/'+fileName, 0, data, {from: accounts[0]});
            await filestorage.finishUpload('test/'+fileName, {from: accounts[0]});

            let reservedSpace = await filestorage.getReservedSpace(accounts[0]);
            let occupiedSpace = await filestorage.getOccupiedSpace(accounts[0]);
            let storagePath = path.join(rmBytesSymbol(accounts[0]), 'test', fileName);
            let status = await filestorage.getFileStatus(storagePath);
            let size = await filestorage.getFileSize(storagePath);
            assert.equal(status, 2, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect");
            assert.equal(reservedSpace, fileSize, "reservedSpace is incorrect");
            assert.equal(occupiedSpace, fileSize, "occupiedSpace is incorrect");

            let content = await filestorage.listDirectory(rmBytesSymbol(accounts[0])+'/test');
            content.find(obj => {
                return obj.name === fileName;
            });
            let receivedData = await filestorage.readChunk(
                rmBytesSymbol(accounts[0]) + '/test/' + fileName,
                0,
                fileSize,
                {gas: 10 ** 8}
            )
            let chunk = addBytesSymbol(receivedData.map(x => rmBytesSymbol(x)).join('')
                .slice(0, 2 * fileSize));
            assert.isTrue(chunk === data);

            await filestorage.deleteFile('test/'+fileName, {from: accounts[0]});
            await filestorage.deleteDirectory('test', {from: accounts[0]});
            await filestorage.reserveSpace(accounts[0], 0, {from: accounts[0]});
        });

        after(async function () {
            let allocatorRole = await filestorage.ALLOCATOR_ROLE();
            await filestorage.revokeRole(allocatorRole, accounts[0]);
        });
    });
});
