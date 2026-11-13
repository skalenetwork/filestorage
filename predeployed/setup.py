#!/usr/bin/env python
# -*- coding: utf-8 -*-
from setuptools import (
    find_packages,
    setup,
)

extras_require = {
    'dev': [
        "twine==7.0.0"
    ],
}

setup(
    name='filestorage-predeployed',
    version='1.1.0',
    description='A tool for generating predeployed filestorage smart contract',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    author='SKALE Labs',
    author_email='support@skalelabs.com',
    url='https://github.com/skalenetwork/filestorage',
    install_requires=[
        "predeployed-generator >= 1.1.0"
    ],
    python_requires='>=3.8,<4',
    extras_require=extras_require,
    keywords=['skale', 'filestorage', 'predeployed'],
    packages=find_packages(),
    package_data={
        'filestorage_predeployed': [
            'artifacts/FileStorage.json',
            'artifacts/FileStorage.meta.json'
        ]
    },
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: GNU Affero General Public License v3 or later (AGPLv3+)',
        'Natural Language :: English',
        'Programming Language :: Python :: 3.8',
    ]
)