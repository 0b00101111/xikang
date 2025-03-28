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
                
                # Try multiple possible collections endpoints
                collections_endpoints = [
                    f"{BASE_URL}/api/me/collection/",  # Note the singular 'collection' with trailing slash
                    f"{BASE_URL}/api/me/collection",   # Singular without trailing slash
                    f"{BASE_URL}/api/me/collections/", # Plural with trailing slash
                    f"{BASE_URL}/api/me/collections",  # Plural without trailing slash
                    f"{BASE_URL}/api/user/collection/",
                    f"{BASE_URL}/api/me/lists/"
                ]
                
                collections_found = False
                for collections_endpoint in collections_endpoints:
                    print(f"Trying collections endpoint: {collections_endpoint}")
                    
                    collections_response = requests.get(collections_endpoint, headers=headers)
                    print(f"Status code: {collections_response.status_code}")
                    
                    if collections_response.status_code == 200:
                        try:
                            collections = collections_response.json()
                            print(f"Response content type: {collections_response.headers.get('Content-Type', 'unknown')}")
                            print(f"Response keys: {list(collections.keys()) if isinstance(collections, dict) else 'Not a dictionary'}")
                            
                            if isinstance(collections, dict) and 'data' in collections:
                                collections_data = collections['data']
                                print(f"Found {len(collections_data)} collections")
                                all_data['collections'] = collections
                                collections_found = True
                                break
                            else:
                                print("Unexpected format for collections data")
                        except json.JSONDecodeError:
                            print(f"Error parsing collections as JSON: {collections_response.text[:200]}")
                    else:
                        print(f"Failed to fetch collections from {collections_endpoint}")
                
                if not collections_found:
                    print("Could not find collections using any endpoint. Trying to get lists instead...")
                    
                    # Try to get reading lists or other types of lists
                    user_url = user_data.get('url', '')
                    if user_url:
                        username = user_url.rstrip('/').split('/')[-1]
                        alt_endpoint = f"{BASE_URL}/api/users/{username}/lists"
                        print(f"Trying alternative endpoint: {alt_endpoint}")
                        
                        alt_response = requests.get(alt_endpoint, headers=headers)
                        print(f"Status code: {alt_response.status_code}")
                        
                        if alt_response.status_code == 200:
                            try:
                                alt_data = alt_response.json()
                                if isinstance(alt_data, dict) and 'data' in alt_data:
                                    collections_data = alt_data['data']
                                    print(f"Found {len(collections_data)} lists")
                                    all_data['collections'] = alt_data
                                else:
                                    print("Unexpected format for lists data")
                            except json.JSONDecodeError:
                                print(f"Error parsing lists as JSON: {alt_response.text[:200]}")
                        else:
                            print(f"Failed to fetch lists: {alt_response.text[:200]}")
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
                # Check if we have an ID or UUID
                collection_id = collection.get('id') or collection.get('uuid')
                collection_name = collection.get('name') or collection.get('title')
                
                if collection_id:
                    print(f"Fetching items for collection: {collection_name} (ID: {collection_id})")
                    
                    # Try both potential endpoints
                    items_endpoints = [
                        f"{BASE_URL}/api/collections/{collection_id}/items/",
                        f"{BASE_URL}/api/collections/{collection_id}/items",
                        f"{BASE_URL}/api/collection/{collection_id}/items/",
                        f"{BASE_URL}/api/collection/{collection_id}/items"
                    ]
                    
                    items_found = False
                    for items_endpoint in items_endpoints:
                        print(f"  Trying: {items_endpoint}")
                        items_response = requests.get(items_endpoint, headers=headers)
                        
                        if items_response.status_code == 200:
                            try:
                                items_data = items_response.json()
                                if 'data' in items_data:
                                    collection['items'] = items_data.get('data', [])
                                    print(f"  - Retrieved {len(collection['items'])} items")
                                    items_found = True
                                    break
                                else:
                                    print(f"  - Unexpected format for items data")
                            except json.JSONDecodeError:
                                print(f"  - Error parsing items as JSON")
                        else:
                            print(f"  - Failed with status: {items_response.status_code}")
                    
                    if not items_found:
                        print(f"  - Could not retrieve items for this collection")
                    
                    # Avoid rate limiting
                    time.sleep(1)
        
        # Try to fetch watched items if authenticated with multiple possible endpoints
        if NEODB_ACCESS_TOKEN:
            print("\nFetching watched items...")
            watched_endpoints = [
                f"{BASE_URL}/api/me/collection/watched/",  # Main endpoint with trailing slash
                f"{BASE_URL}/api/me/collection/watched",   # Without trailing slash
                f"{BASE_URL}/api/me/watched/",
                f"{BASE_URL}/api/me/watched",
                f"{BASE_URL}/api/me/items/watched/",
                f"{BASE_URL}/api/me/watching/",
                f"{BASE_URL}/api/me/collection/watching/"
            ]
            
            watched_found = False
            for watched_endpoint in watched_endpoints:
                print(f"Trying watched endpoint: {watched_endpoint}")
                watched_response = requests.get(watched_endpoint, headers=headers)
                print(f"Status code: {watched_response.status_code}")
                
                if watched_response.status_code == 200:
                    try:
                        watched_data = watched_response.json()
                        print(f"Response keys: {list(watched_data.keys()) if isinstance(watched_data, dict) else 'Not a dictionary'}")
                        
                        if isinstance(watched_data, dict) and 'data' in watched_data:
                            all_data['watched'] = watched_data
                            print(f"Retrieved {len(watched_data.get('data', []))} watched items")
                            watched_found = True
                            break
                        else:
                            print("Unexpected format for watched items data")
                    except json.JSONDecodeError:
                        print(f"Error parsing watched data as JSON: {watched_response.text[:200]}")
                else:
                    print(f"Failed to fetch watched items from {watched_endpoint}")
            
            if not watched_found:
                print("Could not find watched items using any endpoint.")
                
                # Try using user profile information to find collections
                if 'user' in all_data:
                    user_data = all_data['user']
                    user_url = user_data.get('url', '')
                    if user_url:
                        username = user_url.rstrip('/').split('/')[-1]
                        # Try to find any public collections or lists
                        print(f"Trying to find public collections for user: {username}")
                        
                        # Try the public API approach as well
                        public_endpoint = f"{BASE_URL}/api/users/{username}/collections"
                        print(f"Trying public endpoint: {public_endpoint}")
                        
                        public_response = requests.get(public_endpoint, headers=headers)
                        print(f"Status code: {public_response.status_code}")
                        
                        if public_response.status_code == 200:
                            try:
                                public_data = public_response.json()
                                if isinstance(public_data, dict) and 'data' in public_data:
                                    if 'collections' not in all_data:  # Don't overwrite if we already have collections
                                        all_data['collections'] = public_data
                                        print(f"Found {len(public_data.get('data', []))} public collections")
                                else:
                                    print("Unexpected format for public collections data")
                            except json.JSONDecodeError:
                                print(f"Error parsing public collections as JSON: {public_response.text[:200]}")
            
            # Try to get specific information about favorites and watching status
            try_endpoints = [
                f"{BASE_URL}/api/me/books/watching",
                f"{BASE_URL}/api/me/movies/watching",
                f"{BASE_URL}/api/me/tv/watching",
                f"{BASE_URL}/api/me/podcasts/watching",
                f"{BASE_URL}/api/me/albums/watching",
                f"{BASE_URL}/api/me/games/watching"
            ]
            
            for media_endpoint in try_endpoints:
                print(f"Trying media-specific endpoint: {media_endpoint}")
                media_response = requests.get(media_endpoint, headers=headers)
                
                if media_response.status_code == 200:
                    try:
                        media_data = media_response.json()
                        media_type = media_endpoint.split('/')[-2]  # Extract type from URL
                        all_data[f'{media_type}_watching'] = media_data
                        print(f"Retrieved {media_type} watching data")
                    except json.JSONDecodeError:
                        print(f"Error parsing {media_type} data as JSON")
        
    except requests.RequestException as e:
        print(f"Request error: {e}")
    
    # Try to fetch specific media types if other methods failed
    if NEODB_ACCESS_TOKEN and 'collections' not in all_data:
        print("\nAttempting to fetch data by media type...")
        media_types = ["book", "movie", "tv", "podcast", "album", "game"]
        all_media_data = {}
        
        for media_type in media_types:
            # Try different possible endpoints for each media type
            endpoints = [
                f"{BASE_URL}/api/me/{media_type}s/",       # With trailing slash
                f"{BASE_URL}/api/me/{media_type}s",        # Without trailing slash
                f"{BASE_URL}/api/me/collection/{media_type}s/",
                f"{BASE_URL}/api/me/collection/{media_type}s",
                f"{BASE_URL}/api/me/items/{media_type}s/"
            ]
            
            for endpoint in endpoints:
                print(f"Trying {media_type} endpoint: {endpoint}")
                response = requests.get(endpoint, headers=headers)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if isinstance(data, dict) and 'data' in data:
                            all_media_data[f"{media_type}s"] = data
                            print(f"Retrieved {len(data.get('data', []))} {media_type} items")
                            break
                    except json.JSONDecodeError:
                        print(f"Error parsing {media_type} data as JSON")
            
            # Add a small delay to avoid rate limiting
            time.sleep(0.5)
        
        if all_media_data:
            all_data['media_items'] = all_media_data
    
    # Try to fetch specific Mastodon API endpoints that might work
    if NEODB_ACCESS_TOKEN:
        print("\nTrying Mastodon API compatibility endpoints...")
        try:
            mastodon_endpoint = f"{BASE_URL}/api/v1/favourites"
            print(f"Trying endpoint: {mastodon_endpoint}")
            
            mastodon_response = requests.get(mastodon_endpoint, headers=headers)
            if mastodon_response.status_code == 200:
                try:
                    favorites_data = mastodon_response.json()
                    all_data['favorites'] = favorites_data
                    print("Retrieved favorites data via Mastodon API")
                except json.JSONDecodeError:
                    print("Error parsing favorites data as JSON")
        except requests.RequestException as e:
            print(f"Error accessing Mastodon API: {e}")
    
    # Log the final data structure
    print("\nFinal data structure:")
    for key in all_data.keys():
        if isinstance(all_data[key], dict) and 'data' in all_data[key]:
            print(f"- {key}: {len(all_data[key]['data'])} items")
        else:
            print(f"- {key}: (data structure without 'data' key)")
    
    # Save the data if we got any meaningful content
    if all_data and any(key in all_data for key in ['user', 'collections', 'watched', 'media_items', 'favorites']):
        output_file = 'data/neodb-data.json'
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        
        print(f"\nData saved to {output_file}")
        return True
    else:
        print("\nNo data was retrieved or data was incomplete.")
        
        # Save whatever we got for debugging purposes
        if all_data:
            debug_file = 'data/neodb-debug.json'
            os.makedirs(os.path.dirname(debug_file), exist_ok=True)
            
            with open(debug_file, 'w', encoding='utf-8') as f:
                json.dump(all_data, f, ensure_ascii=False, indent=2)
            
            print(f"Limited data saved to {debug_file} for debugging")
        
        return False

if __name__ == "__main__":
    success = fetch_neodb_data()
    sys.exit(0 if success else 1)
