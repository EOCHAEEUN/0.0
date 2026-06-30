import json
import subprocess
import sys
import urllib.request

ROOT = r"c:\Users\Donga\Desktop\EOCHAEEUN\0.0\.worktrees\refine-dashboard-compact"
PY = r"c:\Users\Donga\Desktop\EOCHAEEUN\0.0\backend\venv\Scripts\python.exe"
BACKEND = ROOT + r"\backend"

snap_url = (
    "http://127.0.0.1:8000/api/analyze/support-projects"
    "?company_id=a1d1a619-515e-4d1e-822e-59e2e2e47839"
    "&analysis_id=dd8ce775-d778-4b15-b1b0-8e6aeaf7594a"
    "&limit=40"
)
lat_url = (
    "http://127.0.0.1:8000/api/analyze/support-projects"
    "?company_id=a1d1a619-515e-4d1e-822e-59e2e2e47839"
    "&equipment_id=a9adb13e-0cb4-4f70-9c78-27d1ead5cc7b"
    "&limit=10"
)


def fetch(url):
    with urllib.request.urlopen(url) as resp:
        body = json.loads(resp.read().decode())
    data = body.get("data", body)
    return resp.status, data


npm_exit = subprocess.run(
    ["npm", "run", "build"],
    cwd=ROOT + r"\frontend",
    shell=True,
).returncode
git_exit = subprocess.run(
    ["git", "diff", "--check"],
    cwd=ROOT,
    shell=True,
).returncode

snap_status, snap_data = fetch(snap_url)
lat_status, lat_data = fetch(lat_url)

line = (
    f"snapshot_http={snap_status} "
    f"snapshot_total={snap_data.get('total')} "
    f"snapshot_source={snap_data.get('source')} "
    f"latest_http={lat_status} "
    f"latest_source={lat_data.get('source')} "
    f"npm_exit={npm_exit} "
    f"git_diff_check_exit={git_exit}"
)
print(line)
with open(ROOT + r"\_shell_verify.txt", "w", encoding="utf-8") as f:
    f.write(line + "\n")
sys.exit(0)
