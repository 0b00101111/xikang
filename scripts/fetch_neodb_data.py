import requests
import json
import os
import sys
import time

def fetch_neodb_data():
    # Get credentials from environment variables
    NEODB_USERNAME = os.environ.get("NEODB_USERNAME")
    NEODB_ACCESS_TOKEN = os.environ.get("NEODB_ACCESS_TOKEN")
    NEODB_CLIENT_ID = os.environ.get("NEODB_CLIENT_ID")
    NEODB_CLIENT_SECRET = os.environ.get("NEODB_CLIENT_SECRET")
    
    if not NEODB_USERNAME:
        print("Error: NEODB_USERNAME environment variable is not set")
        return False
    
    print(f"Fetching NeoDB data for user: {NEODB_USERNAME}")
    
    # Base URL for the API
    BASE_URL = "https://neodb.social"
    
    # Setup headers with authorization if token is available
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; DataFetcher/1.0)',
        'Accept': 'application/json'
    }
    
    # Try to use existing access token
    if NEODB_ACCESS_TOKEN:
        headers['Authorization'] = f"Bearer {NEODB_ACCESS_TOKEN}"
        print("Using existing access token")
    elif NEODB_CLIENT_ID and NEODB_CLIENT_SECRET:
        print("No access token available, but client credentials found. You'll need to obtain an access token manually.")
        print("Follow the OAuth flow described in the NeoDB API documentation:")
        print(f"1. Direct user to: {BASE_URL}/oauth/authorize?response_type=code&client_id={NEODB_CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=read+write")
        print("2. Get the authorization code")
        print("3. Exchange it for an access token")
        print("4. Add the access token as a GitHub secret named NEODB_ACCESS_TOKEN")
        return False
    else:
        print("No authentication credentials available")
        print("Will try public endpoints but may encounter restricted access")
    
    all_data = {}
    collections_data = []
    
    # First, try to get user profile
    try:
        if NEODB_ACCESS_TOKEN:
            # Try to access /api/me with the token
            me_endpoint = f"{BASE_URL}/api/me"
            print(f"Fetching user profile: {me_endpoint}")
            
            response = requests.get(me_endpoint, headers=headers)
            print(f"Status code: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"Successfully retrieved user profile: {user_data.get('display_name', 'Unknown')}")
                all_data['user'] = user_data
                
                # Now fetch collections using the authenticated endpoint
                collections_endpoint = f"{BASE_URL}/api/me/collections"
                print(f"Fetching collections: {collections_endpoint}")
                
                collections_response = requests.get(collections_endpoint, headers=headers)
                print(f"Status code: {collections_response.status_code}")
                
                if collections_response.status_code == 200:
                    collections = collections_response.json()
                    if 'data' in collections:
                        collections_data = collections['data']
                        print(f"Found {len(collections_data)} collections")
                        all_data['collections'] = collections
                    else:
                        print("Unexpected format for collections data")
                else:
                    print(f"Failed to fetch collections: {collections_response.text[:200]}")
            else:
                print(f"Authentication failed: {response.text[:200]}")
                
                # Fall back to public API if authentication fails
                print("Falling back to public API endpoints")
        
        # If no token or token request failed, try public endpoints
        if not NEODB_ACCESS_TOKEN or response.status_code != 200:
            # Try public endpoint for user
            public_user_endpoint = f"{BASE_URL}/api/users/{NEODB_USERNAME}"
            print(f"Trying public user endpoint: {public_user_endpoint}")
            
            public_user_response = requests.get(public_user_endpoint, headers=headers)
            print(f"Status code: {public_user_response.status_code}")
            
            if public_user_response.status_code == 200:
                try:
                    user_data = public_user_response.json()
                    print("Successfully retrieved public user data")
                    all_data['user'] = user_data
                except json.JSONDecodeError:
                    print("Error parsing user data as JSON (possibly HTML response)")
            
            # Try public endpoint for collections
            public_collections_endpoint = f"{BASE_URL}/api/users/{NEODB_USERNAME}/collections"
            print(f"Trying public collections endpoint: {public_collections_endpoint}")
            
            public_collections_response = requests.get(public_collections_endpoint, headers=headers)
            print(f"Status code: {public_collections_response.status_code}")
            
            if public_collections_response.status_code == 200:
                try:
                    collections = public_collections_response.json()
                    if 'data' in collections:
                        collections_data = collections['data']
                        print(f"Found {len(collections_data)} collections")
                        all_data['collections'] = collections
                    else:
                        print("Unexpected format for collections data")
                except json.JSONDecodeError:
                    print("Error parsing collections as JSON (possibly HTML response)")
                    print(f"First 200 characters: {public_collections_response.text[:200]}")
        
        # Now fetch items for each collection
        if collections_data:
            print("\nFetching items for each collection...")
            for collection in collections_data:
                collection_id = collection.get('id')
                collection_name = collection.get('name')
                
                if collection_id:
                    print(f"Fetching items for collection: {collection_name} (ID: {collection_id})")
                    
                    items_endpoint = f"{BASE_URL}/api/collections/{collection_id}/items"
                    items_response = requests.get(items_endpoint, headers=headers)
                    
                    if items_response.status_code == 200:
                        try:
                            items_data = items_response.json()
                            if 'data' in items_data:
                                collection['items'] = items_data.get('data', [])
                                print(f"  - Retrieved {len(collection['items'])} items")
                            else:
                                print(f"  - Unexpected format for items data")
                        except json.JSONDecodeError:
                            print(f"  - Error parsing items as JSON")
                    else:
                        print(f"  - Failed to retrieve items. Status: {items_response.status_code}")
                    
                    # Avoid rate limiting
                    time.sleep(1)
        
        # Try to fetch watched items if authenticated
        if NEODB_ACCESS_TOKEN:
            print("\nFetching watched items...")
            watched_endpoint = f"{BASE_URL}/api/me/watched"
            watched_response = requests.get(watched_endpoint, headers=headers)
            
            if watched_response.status_code == 200:
                watched_data = watched_response.json()
                if 'data' in watched_data:
                    all_data['watched'] = watched_data
                    print(f"Retrieved {len(watched_data.get('data', []))} watched items")
                else:
                    print("Unexpected format for watched items data")
            else:
                print(f"Failed to fetch watched items. Status: {watched_response.status_code}")
        
    except requests.RequestException as e:
        print(f"Request error: {e}")
    
    # Save the data if we got any meaningful content
    if all_data and (all_data.get('user') or all_data.get('collections')):
        output_file = 'data/neodb-data.json'
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        
        print(f"\nData saved to {output_file}")
        return True
    else:
        print("\nNo data was retrieved or data was incomplete.")
        return False

if __name__ == "__main__":
    success = fetch_neodb_data()
    sys.exit(0 if success else 1)
