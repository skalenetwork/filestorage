const contractData = require('../../build/contracts/FileStorage.json');
const ozProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');
const Web3 = require('web3');
const web3 = new Web3(process.env.ENDPOINT);

const PROXY_ADMIN_ADDRESS = '0xD3001000000000000000000000000000000000D3';
const FILESTORAGE_PROXY_ADDRESS = '0xD3002000000000000000000000000000000000D3';
const ledger = true;
let rootAccount;
let pk;

if (ledger) {
    const Transport = require('@ledgerhq/hw-transport-node-hid').default
    const AppEth = require('@ledgerhq/hw-app-eth').default
    const devices = await Transport.list()
    if (devices.length === 0) throw 'no device'
    const transport = await Transport.create()
    const eth = new AppEth(transport)
    rootAccount = eth.getAddress(`44'/60'/${index}'/0/0`).address;
} else {
    pk = process.env.PRIVATE_KEY;
    rootAccount = web3.eth.accounts.privateKeyToAccount(pk).address;
}

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
    let gas = await upgradeData.estimateGas(tx);
    tx.gas = gas;
    return signAndSend(tx);
}

async function upgrade() {
    let receipt = await deployImplementation();
    await switchImplementation(receipt.contractAddress);
    console.log('Contract successfully upgraded. New impl address:', receipt.contractAddress);
}

async function signAndSend(txData) {
    if (ledger) {
        const tx = new Tx(txData);
        const serializedTx = tx.serialize().toString('hex');
        const sig = await eth.signTransaction(`44'/60'/${index}'/0/0`, serializedTx);
        txData.v = '0x' + sig.v
        txData.r = '0x' + sig.r
        txData.s = '0x' + sig.s

        const signedTx = new Tx(txData)
        const signedSerializedTx = signedTx.serialize().toString('hex')
        return web3.eth.sendSignedTransaction('0x' + signedSerializedTx)
    } else {
        let signedTx = await web3.eth.accounts.signTransaction(tx, pk);
        return web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    }
}

upgrade();