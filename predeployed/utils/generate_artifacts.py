import json
import os

from filestorage_predeployed import FILESTORAGE_ADDRESS

DIR_PATH = os.path.dirname(os.path.realpath(__file__))
CONTRACT_DATA_PATH = os.path.join(DIR_PATH, '..', 'src', 'filestorage_predeployed', 'artifacts', 'FileStorage.json')
ARTIFACTS_PATH = os.path.join(DIR_PATH, 'data', 'artifacts.json')

if __name__ == '__main__':
    with open(CONTRACT_DATA_PATH, 'r') as f:
        raw_contract_data = f.read()
        contract_data = json.loads(raw_contract_data)
    artifacts = {
        'abi': contract_data['abi'],
        'address': FILESTORAGE_ADDRESS
    }
    with open(ARTIFACTS_PATH, 'w') as f:
        f.write(json.dumps(artifacts, indent=4))