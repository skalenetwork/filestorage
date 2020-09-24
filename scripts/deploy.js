const contractData = require('../build/contracts/FileStorage.json');
var path = require('path');
const fs = require('fs');

const FILESTORAGE_ADDRESS = "0x69362535ec535F0643cBf62D16aDeDCAf32Ee6F7";

let artifactsPath = path.join(path.resolve(__dirname), '..', 'artifacts.json');
let artifactsData;

if (process.argv[2] && process.argv[2] === '--npm') {
    artifactsData = {
        'abi': contractData.abi,
        'address': FILESTORAGE_ADDRESS
    };
} else {
    artifactsData = {
        'abi': contractData.abi,
        'bytecode': contractData.deployedBytecode,
        'address': FILESTORAGE_ADDRESS
    };
}

fs.writeFileSync(artifactsPath, JSON.stringify(artifactsData, null, '\t'));