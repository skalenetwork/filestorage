const chai = require('chai');
const assert = chai.assert;

chai.should();
chai.use(require('chai-as-promised'));

let filestorageTest = artifacts.require('./test/FileStorageTest');
let sendTransaction = require('../utils/helper').sendTransaction;
const generateAccount = require('../utils/helper').generateAccount;
const getFunds = require('../utils/helper').getFunds;
const getNonce = require('../utils/helper').getNonce;

contract('Filestorage', accounts => {
    let filestorage;

    describe('reserveSpace', function () {
        let userAddress;

        beforeEach(async function () {
            let nonce = await getNonce(accounts[0]);
            filestorage = await filestorageTest.new({from: accounts[0], nonce: nonce});
            let allocatorRole = await filestorage.ALLOCATOR_ROLE();
            await filestorage.grantRole(allocatorRole, accounts[0]);
            await filestorage.setStorageSpace(100000);
            userAddress = "0x77333da3492c4DDb9CCf3aD6Bb73d6302F86cdA8";
        });

        it('should reserve space for new user', async function () {
            let space = 1000;
            await filestorage.reserveSpace(userAddress, space);
            let result = await filestorage.getReservedSpace(userAddress);
            let total = await filestorage.getTotalReservedSpace();
            let occupiedSpace = await filestorage.getOccupiedSpace(userAddress);
            assert.equal(result, space);
            assert.equal(total, space);
            assert.equal(occupiedSpace, 0);
        });

        it('should increase space', async function () {
            let space = 1000;
            let newSpace = 2000;
            await filestorage.reserveSpace(userAddress, space);
            await filestorage.reserveSpace(userAddress, newSpace);
            let result = await filestorage.getReservedSpace(userAddress);
            let total = await filestorage.getTotalReservedSpace();
            let occupiedSpace = await filestorage.getOccupiedSpace(userAddress);
            assert.equal(result, newSpace);
            assert.equal(total, newSpace);
            assert.equal(occupiedSpace, 0);
        });

        it('should reserve more than used space', async function () {
            let space = 1000;
            let newSpace = 500;
            await filestorage.reserveSpace(userAddress, space);
            await filestorage.reserveSpace(userAddress, newSpace);
            let result = await filestorage.getReservedSpace(userAddress);
            let total = await filestorage.getTotalReservedSpace();
            assert.equal(result, newSpace);
            assert.equal(total, newSpace);
        });

        it('should fail to reserve not from owner', async function () {
            let account = await generateAccount();
            await getFunds(account.address);
            let tx = filestorage.contract.methods.reserveSpace(userAddress, 1000);
            await sendTransaction(tx, filestorage.address, 20000000, account.privateKey)
                .should
                .eventually
                .rejectedWith('Caller is not allowed to reserve space');
        });

        it('should fail to decrease space', async function () {
            await filestorage.reserveSpace(accounts[0], 2000);
            await filestorage.startUpload("Test", 1500);
            try {
                await filestorage.reserveSpace(accounts[0], 1000);
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, "Could not reserve less than used space");
            }
        });

        it('should fail to reserve more than max space', async function () {
            await filestorage.setStorageSpace(100);
            try {
                await filestorage.reserveSpace(userAddress, 1000);
                assert.fail();
            } catch (error) {
                assert.equal(error.receipt.revertReason, 'Not enough memory in the Filestorage');
            }
        });
    });
});
