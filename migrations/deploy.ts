// tslint:disable:no-console

import { promises as fs } from 'fs';
import { ethers, upgrades, network } from "hardhat";
import { getAbi, getVersion, verifyProxy } from '@skalenetwork/upgrade-tools';


export function getContractKeyInAbiFile(contract: string) {
    return contract.replace(/([a-zA-Z])(?=[A-Z])/g, '$1_').toLowerCase();
}

async function main() {
    const version = await getVersion();
    const [deployer] = await ethers.getSigners();

    console.log("Deploy FileStorage");
    const fileStorageFactory = await ethers.getContractFactory("FileStorage");
    const fileStorage = await upgrades.deployProxy(fileStorageFactory, [deployer.address]);
    await fileStorage.deployTransaction.wait();
    await verifyProxy("FileStorage", fileStorage.address, []);

    console.log("Store ABIs");

    const abiAndAddresses: {[key: string]: string | []} = {};
    abiAndAddresses[getContractKeyInAbiFile("FileStorage") + "_address"] = fileStorage.address;
    abiAndAddresses[getContractKeyInAbiFile("FileStorage") + "_abi"] = getAbi(fileStorage.interface);

    await fs.writeFile(`data/filestorage-${version}-${network.name}-abi-and-addresses.json`, JSON.stringify(abiAndAddresses, null, 4));

    console.log("Done");
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
