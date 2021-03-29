require('dotenv').config();
const fs = require('fs');
const Web3 = require('web3');
const testBalance = '2';
const rootPrivateKey = process.env.SCHAIN_OWNER_PK;
const web3 = new Web3(process.env.ENTRYPOINT);

async function getFunds(account) {
    let testBalanceWei = await web3.utils.toWei(testBalance, 'ether');
    testBalanceWei = Number(testBalanceWei);
    let accountBalance = await web3.eth.getBalance(account);
    accountBalance = Number(accountBalance);
    if (accountBalance < testBalanceWei) {
        let rootAccount = await web3.eth.accounts.privateKeyToAccount(rootPrivateKey).address;
        let valueToSend = testBalanceWei - accountBalance;
        let rootBalance = await web3.eth.getBalance(rootAccount);
        rootBalance = Number(rootBalance);
        if (rootBalance < valueToSend) {
            throw new Error('Insufficient funds for testing');
        }
        let tx = {
            from: rootAccount,
            gas: 21000,
            to: account,
            value: valueToSend,
            chainId: await web3.eth.getChainId()
        };
        let signedTx = await web3.eth.accounts.signTransaction(tx, rootPrivateKey);
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    }
    return true;
}

async function getNonce(address) {
    return web3.eth.getTransactionCount(address);
}

function privateKeyToAddress(privateKey) {
    return web3.eth.accounts.privateKeyToAccount(privateKey).address;
}

async function generateAccount() {
    return web3.eth.accounts.create();
}

async function sendTransaction(transactionData, to, gas, privateKey) {
    let encoded = transactionData.encodeABI();
    let account = await web3.eth.accounts.privateKeyToAccount(privateKey).address;
    let nonce = await web3.eth.getTransactionCount(account);
    let tx = {
        from: account,
        data: encoded,
        gas: gas,
        to: to,
        nonce: nonce,
        chainId: await web3.eth.getChainId()
    };
    let signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    return await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
}

async function initFilestorage(account, artifacts) {
    let filestorage = await artifacts.require('./FileStorageTest').new({from: account});
    await filestorage.setStorageSpace(10**10);
    await filestorage.setContentCount(2**10);
    await filestorage.reserveSpaceStub(account, 10**9);
    return filestorage;
}

function generateTestConfig() {
    let atrifactsPath = path.join(path.resolve(__dirname), '../../build/contracts/FileStorage.json');
    let skaledConfigPath = path.join(path.resolve(__dirname), 'config.json');
    let filestorageBytecode = require(atrifactsPath).deployedBytecode;
    let skaledConfig = require(skaledConfigPath);
    skaledConfig.accounts['0x69362535ec535F0643cBf62D16aDeDCAf32Ee6F7'] = {
        "code": filestorageBytecode,
        "balance": "0",
        "nonce": "0",
        "storage": {
            "0x00": "0xffffffffff"
        }
    };
    fs.writeFileSync(skaledConfigPath, JSON.stringify(skaledConfig, null, '\t'));
}

module.exports.getFunds = getFunds;
module.exports.privateKeyToAddress = privateKeyToAddress;
module.exports.sendTransaction = sendTransaction;
module.exports.initFilestorage = initFilestorage;
module.exports.generateTestConfig = generateTestConfig;
module.exports.generateAccount = generateAccount;
module.exports.getNonce = getNonce;
