from roguepedia import __version__
from roguepedia.config import settings


def test_package_imports():
    assert __version__ == "0.1.0"
    assert settings.app_env == "development"
