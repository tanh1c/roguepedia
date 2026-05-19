import roguepedia.clients
import roguepedia.engines
import roguepedia.generation
import roguepedia.normalizers
import roguepedia.schemas
import roguepedia.storage
import roguepedia.validation


def test_internal_packages_import():
    assert roguepedia.schemas is not None
