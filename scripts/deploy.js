var path = require('path');
const fs = require('fs');
const contractData = require('../build/contracts/FileStorage.json');

let artifactsPath = path.join(path.resolve(__dirname), '..', 'artifacts.json');
let FILESTORAGE_ADDRESS =
let artifactsData = {
    'abi': contractData.abi,
    'address': FILESTORAGE_ADDRESS
};

fs.writeFileSync(artifactsPath, JSON.stringify(artifactsData, null, '\t'));