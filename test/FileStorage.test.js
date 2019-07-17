
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
        beforeEach(async function () {
            filestorage = await FileStorage.new({from: accounts[0]});
        });

        it('should startUploading', async function () {
            let fileName = randomstring.generate();
            let fileSize = Math.floor(Math.random()*100);
            await filestorage.startUpload(fileName, fileSize, {from: accounts[0]});
            let storagePath = rmBytesSymbol(accounts[0])+'/'+fileName;
            let status = await filestorage.getFileStatus.call(storagePath);
            let size = await filestorage.getFileSize.call(storagePath);
            assert.equal(status, 1, 'Status is incorrect');
            assert.equal(size, fileSize, "Size is incorrect")
        });
    })
});
