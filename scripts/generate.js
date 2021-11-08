const contractData = require('../build/contracts/FileStorage.json');
const ozProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');
const ozAdminUpgradeabilityProxy = require('@openzeppelin/upgrades-core/artifacts/AdminUpgradeabilityProxy.json');

const PROXY_ADMIN_ADDRESS = '0xD3001000000000000000000000000000000000D3';
const FILESTORAGE_PROXY_ADDRESS = '0xD3002000000000000000000000000000000000D3';
const FILESTORAGE_IMPLEMENTATION_ADDRESS = '0xD3003000000000000000000000000000000000D3';

const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const STORAGE_SPACE_SLOT = '0x3c39c62cb61ae774091322c3a742c0553a9b766b6285c7730ebd72b6cd270fb7';
const BASE_SLOT = '0x0';

const TEST_ROLES_SLOTS = {
    "0x683723e34a772b6e4f2c919bba7fa32ed8ea11a8325f54da7db716e9d9dd98c7": "0x01",
    "0x9b45063904f2ebdb41aaf8a5497dea92590ffba8896d1c63b108aa6868119ada": "0x01",
    "0x2dd8db9e26b2996e42648eaa4a235e69f68c16392431007c6e963fa26c4b8212": "0xd2c5b39b4e735c17612bb5a08fd024ccc5dbcb23",
    "0x2a7e0be9e49f90b81d1db502fcecd7cc7059330a12c2d322257a272c1d31f827": "0x01"
}

let artifactsData;
let config;

function generateArtifacts(npm=false) {
    if (npm) {
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
        config['filestorageProxy']['storage'][STORAGE_SPACE_SLOT] = '{{ allocated_storage }}';
        config['filestorageProxy']['storage'][ADMIN_SLOT] = PROXY_ADMIN_ADDRESS;
        config['filestorageProxy']['storage'][IMPLEMENTATION_SLOT] = FILESTORAGE_IMPLEMENTATION_ADDRESS;
        artifactsData['predeployedConfig'] = config;
    }
    return artifactsData;
}

function generatePredeployedData(ownerAddress, allocatedStorage) {
    let contracts = generateArtifacts()['predeployedConfig'];
    let config = {}
    for (let name in contracts) {
        let contract = contracts[name];
        if (name === 'proxyAdmin') {
            contract.storage[BASE_SLOT] = ownerAddress;
        }
        if (name === 'filestorageProxy') {
            contract.storage[STORAGE_SPACE_SLOT] = allocatedStorage.toString();
            contract.storage = {...contract.storage, ...TEST_ROLES_SLOTS};
        }
        config[contract.address] = {
            'code': contract.bytecode,
            'storage': contract.storage,
            'balance': '0',
            'nonce': '0',
        }
    }
    return config;
}

module.exports.generateArtifacts = generateArtifacts;
module.exports.generatePredeployedData = generatePredeployedData;
module.exports.FILESTORAGE_PROXY_ADDRESS = FILESTORAGE_PROXY_ADDRESS;
