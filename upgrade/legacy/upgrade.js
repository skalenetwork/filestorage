const contractData = require('../../build/contracts/FileStorage.json');
const ozProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');
const Web3 = require('web3');
const web3 = new Web3(process.env.ENDPOINT);

const PROXY_ADMIN_ADDRESS = '0xD3001000000000000000000000000000000000D3';
const FILESTORAGE_PROXY_ADDRESS = '0xD3002000000000000000000000000000000000D3';

let pk = process.env.PRIVATE_KEY;
let rootAccount = web3.eth.accounts.privateKeyToAccount(pk).address;

async function deployImplementation() {
    let implementationDeployment = new web3.eth.Contract(contractData.abi).deploy({
        data: contractData.bytecode
    });
    let tx = {
        from: rootAccount,
        nonce: await web3.eth.getTransactionCount(rootAccount),
        chainId: await web3.eth.getChainId(),
        data: implementationDeployment.encodeABI(),
    };
    let gas = await implementationDeployment.estimateGas(tx);
    tx.gas = gas;
    let signedTx = await web3.eth.accounts.signTransaction(tx, pk);
    return web3.eth.sendSignedTransaction(signedTx.rawTransaction);
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
    let gas = await upgradeData.estimateGas(tx);
    tx.gas = gas;
    let signedTx = await web3.eth.accounts.signTransaction(tx, pk);
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
}

async function upgrade() {
    let receipt = await deployImplementation();
    await switchImplementation(receipt.contractAddress);
    console.log('Contract successfully upgraded. New impl address:', receipt.contractAddress);
}

upgrade();