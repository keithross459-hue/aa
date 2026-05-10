#!/usr/bin/env python
"""End-to-end smoke test for /api/products/generate"""
import os
import sys
import json
import subprocess
import time
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import jwt as pyjwt

load_dotenv("backend/.env")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ.get("JWT_ISSUER", "fiilthy.ai")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "fiilthy-app")

def make_test_token(user_id: str = "test-user-001") -> str:
    """Generate a valid JWT token."""
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

def test_api():
    """Run the API smoke test."""
    token = make_test_token()
    print("✓ JWT token generated")
    
    url = "http://localhost:8000/api/products/generate"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "niche": "fitness",
        "audience": "busy adults",
        "product_type": "ebook",
    }
    
    print("\n=== API REQUEST ===")
    print(f"POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("\n=== SENDING REQUEST ===")
    
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=90)
        print(f"HTTP Status: {resp.status_code}")
        
        if resp.status_code >= 400:
            print(f"FAIL: HTTP {resp.status_code}")
            print(f"Response: {resp.text[:2000]}")
            return False
        
        data = resp.json()
        print("\n=== RESPONSE JSON ===")
        resp_str = json.dumps(data, indent=2)
        print(resp_str[:2000])
        
        # Validate response shape
        required_fields = ["id", "title", "tagline", "description", "bullet_features", "outline", "price"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            print(f"FAIL: Missing fields: {missing}")
            return False
        
        # Validate bullet_features count
        bullets = data.get("bullet_features", [])
        if len(bullets) < 3:
            print(f"FAIL: Only {len(bullets)} bullet_features (expected >= 3)")
            print(f"Bullets: {bullets}")
            return False
        
        print("\n✓ Response has all required fields")
        print(f"✓ Product ID: {data['id']}")
        print(f"✓ Title: {data['title']}")
        print(f"✓ Bullet features: {len(bullets)}")
        print(f"✓ Outline sections: {len(data.get('outline', []))}")
        print(f"✓ Price: ${data['price']}")
        
        print("\nPASS: /api/products/generate smoke test passed!")
        return True
        
    except requests.exceptions.ConnectionError as ex:
        print(f"FAIL: Could not connect to backend at {url}")
        print(f"Error: {ex}")
        return False
    except Exception as ex:
        print(f"FAIL: Request failed with error: {ex}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=== SMOKE TEST: /api/products/generate ===\n")
    
    # Start backend server
    print("Step 1: Start backend server...")
    proc = subprocess.Popen(
        [sys.executable, "backend/server.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    
    # Wait for server to start
    print("Waiting for backend to initialize (5 seconds)...")
    time.sleep(5)
    
    if proc.poll() is not None:
        stdout, stderr = proc.communicate()
        print("FAIL: Backend server failed to start")
        print(f"Stdout: {stdout.decode()[:1000]}")
        print(f"Stderr: {stderr.decode()[:1000]}")
        return False
    
    print(f"✓ Backend server started (PID: {proc.pid})")
    
    # Run API test
    print("\nStep 2: Run API smoke test...")
    try:
        success = test_api()
    except Exception as ex:
        print(f"FAIL: Test failed with exception: {ex}")
        import traceback
        traceback.print_exc()
        success = False
    finally:
        print("\nStep 3: Shutting down backend...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=2)
        print("✓ Backend terminated")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
