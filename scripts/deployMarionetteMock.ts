import { ethers } from "hardhat";

async function main() {
    const marionetteMockFactory = await ethers.getContractFactory("MarionetteMock");
    const marionetteMock = await marionetteMockFactory.deploy();
    await marionetteMock.deployTransaction.wait();
    console.log("MarionetteMock address: " + marionetteMock.address);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
