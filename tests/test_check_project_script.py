import subprocess
import sys


def test_check_project_script_runs():
    result = subprocess.run(
        [sys.executable, "scripts/check_project.py"],
        capture_output=True,
        check=True,
        text=True,
    )

    assert "Roguepedia 0.1.0" in result.stdout
