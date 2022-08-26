#   -*- coding: utf-8 -*-
#
#   This file is part of skale-checks
#
#   Copyright (C) 2021-Present SKALE Labs
#
#   This program is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   This program is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU Affero General Public License for more details.
#
#   You should have received a copy of the GNU Affero General Public License
#   along with this program.  If not, see <https://www.gnu.org/licenses/>.

from os.path import dirname, join
from typing import Dict

from web3.auto import w3

from predeployed_generator.upgradeable_contract_generator import UpgradeableContractGenerator
from predeployed_generator.openzeppelin.access_control_enumerable_generator \
    import AccessControlEnumerableGenerator


class FileStorageGenerator(AccessControlEnumerableGenerator):
    '''Generates FileStorage
    '''

    ARTIFACT_FILENAME = 'FileStorage.json'
    META_FILENAME = 'FileStorage.meta.json'
    DEFAULT_ADMIN_ROLE = (0).to_bytes(32, 'big')
    STORAGE_SPACE_SLOT = int.from_bytes(
        w3.solidityKeccak(['string'], ['STORAGE_SPACE_SLOT']),
        byteorder='big')

    # ---------- storage ----------
    # --------Initializable--------
    # 0:    _initialized, _initializing;
    # -----ContextUpgradeable------
    # 1:    __gap
    # ...   __gap
    # 50:   __gap
    # ------ERC165Upgradeable------
    # 51:   __gap
    # ...   __gap
    # 100:  __gap
    # --AccessControlUpgradeable---
    # 101:  _roles
    # 102:  __gap
    # ...   __gap
    # 150:  __gap
    # AccessControlEnumerableUpgradeable
    # 151:  _roleMembers
    # 152:  __gap
    # ...   __gap
    # 200:  __gap
    # ---------TokenManager---------
    # 201:  version

    ROLES_SLOT = 101
    ROLE_MEMBERS_SLOT = 151
    VERSION_SLOT = 201

    def __init__(self):
        generator = FileStorageGenerator.from_hardhat_artifact(
            join(dirname(__file__), 'artifacts', self.ARTIFACT_FILENAME),
            join(dirname(__file__), 'artifacts', self.META_FILENAME))
        super().__init__(
            bytecode=generator.bytecode,
            abi=generator.abi,
            meta=generator.meta
        )

    @classmethod
    def generate_storage(cls, **kwargs) -> Dict[str, str]:
        schain_owner = kwargs['schain_owner']
        allocated_storage = kwargs['allocated_storage']
        version = kwargs['version']
        storage: Dict[str, str] = {}
        roles_slots = cls.RolesSlots(roles=cls.ROLES_SLOT, role_members=cls.ROLE_MEMBERS_SLOT)
        cls._setup_role(storage, roles_slots, cls.DEFAULT_ADMIN_ROLE, [schain_owner])
        cls._write_uint256(storage, cls.STORAGE_SPACE_SLOT, allocated_storage)
        cls._write_string(storage, cls.VERSION_SLOT, version)
        return storage


class UpgradeableFileStorageGenerator(UpgradeableContractGenerator):
    '''Generates upgradeable instance of FileStorageUpgradeable
    '''

    def __init__(self):
        super().__init__(implementation_generator=FileStorageGenerator())
