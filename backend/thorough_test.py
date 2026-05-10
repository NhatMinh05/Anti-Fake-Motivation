import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"

TESTS = [
    ("/api/history?limit=2", "GET", None),
    ("/api/history?limit=0", "GET", None),
    ("/api/history?limit=-1", "GET", None),
    ("/api/history?limit=999", "GET", None),
    ("/api/history/range?days=30", "GET", None),
    ("/api/history/range?days=0", "GET", None),
    ("/api/history/range?days=-5", "GET", None),
    ("/api/history/range?days=99999", "GET", None),
    ("/api/analytics", "GET", None),
    ("/api/config", "GET", None),
    ("/api/config", "POST", {"personality_mode": "RUTHLESS_MODE"}),
    ("/api/config", "GET", None),
    ("/api/reset", "POST", {"confirm": False}),
    ("/api/reset", "POST", {"confirm": True}),
    ("/api/score", "GET", None),
    ("/api/chat", "POST", {"message": "I skipped work today", "personality": "RUTHLESS_MODE"}),
]

for path, method, body in TESTS:
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            content = res.read().decode()
            print(f"--- {method} {path} => {res.status}")
            print(content[:700])
    except urllib.error.HTTPError as e:
        content = e.read().decode()
        print(f"--- {method} {path} => {e.code}")
        print(content[:700])
    except Exception as ex:
        print(f"--- {method} {path} => EXCEPTION")
        print(str(ex))
