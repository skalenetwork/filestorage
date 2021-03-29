const contractData = require('../build/contracts/FileStorage.json');
const ozProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');
const ozAdminUpgradeabilityProxy = require('@openzeppelin/upgrades-core/artifacts/AdminUpgradeabilityProxy.json');
var path = require('path');
const fs = require('fs');

const PROXY_ADMIN_ADDRESS = '0xD3001000000000000000000000000000000000D3';
const UPGRADEABLE_PROXY_ADDRESS = '0xD4001000000000000000000000000000000000D4';
const FILESTORAGE_IMPLEMENTATION_ADDRESS = "0x69362535ec535F0643cBf62D16aDeDCAf32Ee6F7";

const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const OWNER_SLOT = '0x0';

let artifactsPath = path.join(path.resolve(__dirname), '..', 'artifacts.json');
let artifactsData;
let proxy;

if (process.argv[2] && process.argv[2] === '--npm') {
    artifactsData = {
        'abi': contractData.abi,
        'address': UPGRADEABLE_PROXY_ADDRESS
    };
} else {
    artifactsData = {
        'abi': contractData.abi,
        'bytecode': contractData.deployedBytecode,
        'address': UPGRADEABLE_PROXY_ADDRESS,
    };
    proxy = {
        'proxyAdmin': {
            'address': PROXY_ADMIN_ADDRESS,
            'bytecode': ozProxyAdmin.deployedBytecode,
            'storage': {}
        },
        'upgradeabilityProxy': {
            'address': UPGRADEABLE_PROXY_ADDRESS,
            'bytecode': ozAdminUpgradeabilityProxy.deployedBytecode,
            'storage': {}
        }
    }
    proxy['proxyAdmin']['storage'][OWNER_SLOT] = '';
    proxy['upgradeabilityProxy']['storage'][ADMIN_SLOT] = PROXY_ADMIN_ADDRESS;
    proxy['upgradeabilityProxy']['storage'][IMPLEMENTATION_SLOT] = FILESTORAGE_IMPLEMENTATION_ADDRESS;
    artifactsData['proxy'] = proxy;
}

fs.writeFileSync(artifactsPath, JSON.stringify(artifactsData, null, '\t'));