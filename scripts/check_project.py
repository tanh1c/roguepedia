import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from roguepedia import __version__
from roguepedia.config import settings


def main() -> None:
    print(f"Roguepedia {__version__}")
    print(f"Environment: {settings.app_env}")
    print(f"Data directory: {settings.data_dir}")


if __name__ == "__main__":
    main()
