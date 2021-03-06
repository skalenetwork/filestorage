const contractData = require('../build/contracts/FileStorage.json');
const ozProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');
const ozAdminUpgradeabilityProxy = require('@openzeppelin/upgrades-core/artifacts/AdminUpgradeabilityProxy.json');
var path = require('path');
const fs = require('fs');

const PROXY_ADMIN_ADDRESS = '0xD3001000000000000000000000000000000000D3';
const FILESTORAGE_PROXY_ADDRESS = '0xD3002000000000000000000000000000000000D3';
const FILESTORAGE_IMPLEMENTATION_ADDRESS = '0xD3003000000000000000000000000000000000D3';

const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const BASE_SLOT = '0x0';

let artifactsPath = path.join(path.resolve(__dirname), '..', 'artifacts.json');
let artifactsData;
let config;

if (process.argv[2] && process.argv[2] === '--npm') {
    artifactsData = {
        'abi': contractData.abi,
        'address': FILESTORAGE_PROXY_ADDRESS
    };
} else {
    artifactsData = {
        'abi': contractData.abi,
        'address': FILESTORAGE_PROXY_ADDRESS,
    };
    config = {
        'proxyAdmin': {
            'address': PROXY_ADMIN_ADDRESS,
            'bytecode': ozProxyAdmin.deployedBytecode,
            'storage': {}
        },
        'filestorageProxy': {
            'address': FILESTORAGE_PROXY_ADDRESS,
            'bytecode': ozAdminUpgradeabilityProxy.deployedBytecode,
            'storage': {}
        },
        'filestorageImplementation': {
            'address': FILESTORAGE_IMPLEMENTATION_ADDRESS,
            'bytecode': contractData.deployedBytecode,
            'storage': {}
        }
    }
    config['proxyAdmin']['storage'][BASE_SLOT] = '{{ owner_address }}';
    config['filestorageProxy']['storage'][BASE_SLOT] = '{{ allocated_storage }}';
    config['filestorageProxy']['storage'][ADMIN_SLOT] = PROXY_ADMIN_ADDRESS;
    config['filestorageProxy']['storage'][IMPLEMENTATION_SLOT] = FILESTORAGE_IMPLEMENTATION_ADDRESS;
    artifactsData['predeployedConfig'] = config;
}

fs.writeFileSync(artifactsPath, JSON.stringify(artifactsData, null, '\t'));