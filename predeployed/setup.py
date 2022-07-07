#!/usr/bin/env python
# -*- coding: utf-8 -*-
from setuptools import (
    find_packages,
    setup,
)

extras_require = {
    'linter': [
        "flake8==3.7.9"
    ],
    'dev': [
        "twine==3.1.1"
    ],
}

extras_require['dev'] = (
    extras_require['linter'] + extras_require['dev']
)

setup(
    name='filestorage-predeployed',
    version='1.1.0',
    description='A tool for generating predeployed filestorage smart contract',
    long_description_markdown_filename='README.md',
    author='SKALE Labs',
    author_email='support@skalelabs.com',
    url='https://github.com/skalenetwork/filestorage',
    install_requires=[
        "predeployed-generator >= 1.1.0a1"
    ],
    python_requires='>=3.7,<4',
    extras_require=extras_require,
    keywords=['skale', 'filestorage', 'predeployed'],
    packages=find_packages(),
    package_data={
        'filestorage_predeployed': ['artifacts/FileStorage.json']
    },
    classifiers=[
        'Development Status :: 5 - Production/Stable',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: GNU Affero General Public License v3 or later (AGPLv3+)',
        'Natural Language :: English',
        'Programming Language :: Python :: 3.7',
    ]
)