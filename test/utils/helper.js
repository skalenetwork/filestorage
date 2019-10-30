require('dotenv').config();
const Web3 = require('web3');
const testBalance = '2';
const rootPrivateKey = process.env.SCHAIN_OWNER_PK;
const web3 = new Web3(process.env.ENTRYPOINT);

async function getFunds(account) {
    let testBalanceWei = await web3.utils.toWei(testBalance, 'ether');
    let accountBalance = await web3.eth.getBalance(account);
    let rootAccount = web3.eth.accounts.privateKeyToAccount(rootPrivateKey).address;
    let rootBalance = await web3.eth.getBalance(rootAccount);
    if (accountBalance < testBalanceWei) {
        let valueToSend = testBalanceWei - accountBalance;
        if (rootBalance < valueToSend) {
            throw new Error('Insufficient funds for testing');
        }
        let tx = {
            from: rootAccount,
            gas: 21000,
            to: account,
            value: valueToSend
        };
        let signedTx = await web3.eth.accounts.signTransaction(tx, rootPrivateKey);
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    }
    return true;
}

function privateKeyToAddress(privateKey) {
    return web3.eth.accounts.privateKeyToAccount(privateKey).address;
}

async function sendTransaction(transactionData, to, gas, privateKey) {
    let encoded = transactionData.encodeABI();
    let account = web3.eth.accounts.privateKeyToAccount(privateKey).address;
    let nonce = await web3.eth.getTransactionCount(account);
    let tx = {
        from: account,
        data: encoded,
        gas: gas,
        to: to,
        nonce: nonce
    };
    let signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
    return await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
}

module.exports.getFunds = getFunds;
module.exports.privateKeyToAddress = privateKeyToAddress;
module.exports.sendTransaction = sendTransaction;