import requests
import json
import os

# Get username from environment variable
NEODB_USERNAME = os.environ.get("NEODB_USERNAME", "your_username")
print(f"Testing NeoDB API for user: {NEODB_USERNAME}")

# Try different potential endpoints
endpoints = [
    f"https://neodb.social/api/users/{NEODB_USERNAME}",
    f"https://neodb.social/users/{NEODB_USERNAME}",
    f"https://neodb.social/api/users/{NEODB_USERNAME}/outbox",
    f"https://neodb.social/users/{NEODB_USERNAME}/outbox",
    f"https://neodb.social/api/users/{NEODB_USERNAME}/collections",
    f"https://neodb.social/users/{NEODB_USERNAME}/collections"
]

for endpoint in endpoints:
    print(f"\nTrying endpoint: {endpoint}")
    
    try:
        response = requests.get(endpoint)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            # Try to parse as JSON
            try:
                data = response.json()
                print("Successfully parsed JSON response")
                print(f"Data keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dictionary'}")
            except Exception as e:
                print(f"Error parsing JSON: {e}")
                print("First 100 characters of response:", response.text[:100])
        else:
            print("Request failed")
            
    except Exception as e:
        print(f"Error making request: {e}")

print("\nTest complete")
