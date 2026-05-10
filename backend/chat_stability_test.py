import json
import time
import urllib.request

URL = "http://127.0.0.1:8000/api/chat"

ok = 0
fail = 0

for i in range(5):
    payload = {
        "message": f"stability test #{i+1}",
        "personality": "RUTHLESS_MODE"
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            body = res.read().decode()
            print(f"[{i+1}] OK {body[:220]}")
            ok += 1
    except Exception as e:
        print(f"[{i+1}] FAIL {e}")
        fail += 1
    time.sleep(1)

print({"ok": ok, "fail": fail})
