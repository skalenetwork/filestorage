from os.path import normpath, join, dirname
from predeployed_generator.tools import ArtifactsHandler

pkg_name = 'filestorage_predeployed'
package_artifacts_path = normpath(join(dirname(__file__), f'../{pkg_name}/artifacts'))
hardhat_contracts_path = normpath(join(dirname(__file__), '../../artifacts/contracts'))


def prepare():
    handler = ArtifactsHandler(hardhat_contracts_path, package_artifacts_path)
    handler.prepare_artifacts('FileStorage')


if __name__ == '__main__':
    prepare()
