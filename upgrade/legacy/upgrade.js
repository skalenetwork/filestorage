const contractData = require('../../build/contracts/FileStorage.json');
const ozProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');

const { LedgerSigner } = require("@ethersproject/hardware-wallets");
const { providers } = require('ethers');
const Web3 = require('web3');

const web3 = new Web3(process.env.ENDPOINT);

const PROXY_ADMIN_ADDRESS = '0xD3001000000000000000000000000000000000D3';
const FILESTORAGE_PROXY_ADDRESS = '0xD3002000000000000000000000000000000000D3';

let rootAccount;
let pk;
let ledgerAddressIndex;
let ledger;

if (process.argv[2]) {
    ledgerAddressIndex = parseInt(process.argv[2]);
}

async function init() {
    if (ledgerAddressIndex !== null) {
        const provider = new providers.JsonRpcProvider(process.env.ENDPOINT, {
            chainId: await web3.eth.getChainId(),
        })
        ledger = new LedgerSigner(provider, 'hid', `44'/60'/${ledgerAddressIndex}'/0/0`);
        rootAccount = await ledger.getAddress();
    } else {
        pk = process.env.PRIVATE_KEY;
        rootAccount = web3.eth.accounts.privateKeyToAccount(pk).address;
    }
}

async function deployImplementation() {
    let implementationDeployment = new web3.eth.Contract(contractData.abi).deploy({
        data: contractData.bytecode
    });
    let tx = {
        from: rootAccount,
        nonce: await web3.eth.getTransactionCount(rootAccount),
        chainId: await web3.eth.getChainId(),
        data: implementationDeployment.encodeABI()
    };
    tx.gas = await implementationDeployment.estimateGas(tx);
    return signAndSend(tx);
}

async function switchImplementation(newAddress) {
    let proxyAdmin = new web3.eth.Contract(ozProxyAdmin.abi, PROXY_ADMIN_ADDRESS);
    let upgradeData = proxyAdmin.methods.upgrade(FILESTORAGE_PROXY_ADDRESS, newAddress);
    let tx = {
        from: rootAccount,
        to: PROXY_ADMIN_ADDRESS,
        nonce: await web3.eth.getTransactionCount(rootAccount),
        chainId: await web3.eth.getChainId(),
        data: upgradeData.encodeABI(),
    };
    tx.gas = await upgradeData.estimateGas(tx);
    return signAndSend(tx);
}

async function upgrade() {
    let receipt = await deployImplementation();
    await switchImplementation(receipt.contractAddress);
    console.log('Contract successfully upgraded. New impl address:', receipt.contractAddress);
}

async function signAndSend(txData) {
    if (ledgerAddressIndex !== null) {
        txData.gasLimit = txData.gas;
        txData.gasPrice = 100001;
        txData.chainId = '';
        let signedTx = await ledger.signTransaction(txData);
        return web3.eth.sendSignedTransaction(signedTx);
    } else {
        let signedTx = await web3.eth.accounts.signTransaction(tx, pk);
        return web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    }
}

async function main() {
    await init();
    await upgrade();
}

main();