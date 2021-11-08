const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

const FileStorageTest = artifacts.require("./test/FileStorageTest");
const FileStorage = artifacts.require("./FileStorage");

contract('Filestorage', accounts => {
    let filestorage;

    describe('getTotalStorageSpace', function () {
        it('should return 0 for FileStorage', async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
            let spaceSize = await filestorage.getTotalStorageSpace();
            assert.equal(spaceSize, 0);
        });

        it('should return 10 ** 10 for FileStorageTest contract', async function () {
            filestorage = await FileStorageTest.new({from: accounts[0]});
            await filestorage.setStorageSpace(10 ** 10)
            let spaceSize = await filestorage.getTotalStorageSpace();
            assert.equal(spaceSize, 10 ** 10);
        });
    });
});
