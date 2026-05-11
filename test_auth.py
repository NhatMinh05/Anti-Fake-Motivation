import urllib.request, urllib.parse, json

# Test register
data = json.dumps({"username": "testuser", "password": "test123"}).encode()
req = urllib.request.Request(
    'http://localhost:8000/api/auth/register',
    data=data,
    headers={'Content-Type': 'application/json'}
)
try:
    r = urllib.request.urlopen(req)
    print('register:', r.read().decode())
except Exception as e:
    print('register error:', e)

# Test login
data2 = urllib.parse.urlencode({'username': 'testuser', 'password': 'test123'}).encode()
req2 = urllib.request.Request(
    'http://localhost:8000/api/auth/login',
    data=data2,
    headers={'Content-Type': 'application/x-www-form-urlencoded'}
)
try:
    r2 = urllib.request.urlopen(req2)
    print('login:', r2.read().decode())
except Exception as e:
    print('login error:', e)
