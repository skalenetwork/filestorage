import chalk from "chalk";
import hre, { ethers } from "hardhat";
import { existsSync, promises as fs } from "fs";
import { Upgrader } from "@skalenetwork/upgrade-tools";
import { FileStorage } from "../typechain-types";
import { SkaleABIFile } from "@skalenetwork/upgrade-tools/dist/src/types/SkaleABIFile";

const file_storage_address = "0xD3002000000000000000000000000000000000d3";

class FileStorageUpgrader extends Upgrader {

    async getFileStorage() {
        return await ethers.getContractAt("FileStorage", this.abi["file_storage_address"] as string) as FileStorage;
    }

    getDeployedVersion = async () => {
        const fileStorage = await this.getFileStorage();
        try {
            return await fileStorage.version();
        } catch {
            console.log(chalk.red("Can't read deployed version"));
        }
    }

    setVersion = async (newVersion: string) => {
        const fileStorage = await this.getFileStorage();
        this.transactions.push({
            to: fileStorage.address,
            data: fileStorage.interface.encodeFunctionData("setVersion", [newVersion])
        });
    }

}

async function getFileStorageAbiAndAddress(): Promise<SkaleABIFile> {
    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        process.exit(1);
    }
    const abiFilename = process.env.ABI;
    return JSON.parse(await fs.readFile(abiFilename, "utf-8"));
        
}
async function main() {

    // prepare the manifest
    const { chainId } = await hre.ethers.provider.getNetwork();
    const originManifestFileName = __dirname + "/../.openzeppelin/predeployed.json";
    const targetManifestFileName = __dirname + `/../.openzeppelin/unknown-${chainId}.json`;

    if (!existsSync(targetManifestFileName)) {
        console.log("Create a manifest file based on predeployed template");
        await fs.copyFile(originManifestFileName, targetManifestFileName);
    }


    let abi: SkaleABIFile;
    if (process.env.ABI) {
        // a file with filestorage address is provided
        abi = JSON.parse(await fs.readFile(process.env.ABI, "utf-8")) as SkaleABIFile;
    } else {
        // use default one
        abi = {
            "file_storage_address": file_storage_address
        }
    }

    const upgrader = new FileStorageUpgrader(
        "filestorage",
        "1.1.0",
        await getFileStorageAbiAndAddress(),
        ["FileStorage"]
    );

    await upgrader.upgrade();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}