# filestorage-predeployed

## Description

A tool for generating predeployed filestorage smart contract

## Installation

```console
pip install filestorage-predeployed
```

## Usage example

```python
from filestorage_predeployed import  UpgradeableFileStorageGenerator, FILESTORAGE_ADDRESS, FILESTORAGE_IMPLEMENTATION_ADDRESS

OWNER_ADDRESS = '0xd200000000000000000000000000000000000000'
PROXY_ADMIN_ADDRESS = '0xd200000000000000000000000000000000000001'
ALLOCATED_STORAGE = 1000000

filestorage_generator = UpgradeableFileStorageGenerator()

genesis = {
    # genesis block parameters
    'alloc': {
        **filestorage_generator.generate_allocation(
            contract_address=FILESTORAGE_ADDRESS,
            implementation_address=FILESTORAGE_IMPLEMENTATION_ADDRESS,
            schain_owner=OWNER_ADDRESS,
            proxy_admin_address=PROXY_ADMIN_ADDRESS,
            allocated_storage=ALLOCATED_STORAGE
        )
    }
}

```