import requests
import json
import os
import sys
import time

def fetch_neodb_data():
    # Get credentials from environment variables
    NEODB_USERNAME = os.environ.get("NEODB_USERNAME")
    NEODB_ACCESS_TOKEN = os.environ.get("NEODB_ACCESS_TOKEN")
    
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
    
    # Add authorization token if available
    if NEODB_ACCESS_TOKEN:
        headers['Authorization'] = f"Bearer {NEODB_ACCESS_TOKEN}"
        print("Using access token for authentication")
    else:
        print("No access token available. Authentication may fail.")
        return False
    
    # Initialize data structure
    all_data = {
        'metadata': {
            'username': NEODB_USERNAME,
            'fetch_time': time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        }
    }
    
    # 1. Fetch user profile
    try:
        print("\n1. Fetching user profile")
        user_endpoint = f"{BASE_URL}/api/me"
        print(f"Endpoint: {user_endpoint}")
        
        response = requests.get(user_endpoint, headers=headers)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            all_data['user'] = user_data
            print(f"Successfully retrieved user profile: {user_data.get('display_name', 'Unknown')}")
            
            # Extract handle for later use
            user_url = user_data.get('url', '')
            if user_url:
                handle = user_url.rstrip('/').split('/')[-1]
                all_data['metadata']['handle'] = handle
                print(f"Extracted handle: {handle}")
        else:
            print(f"Failed to fetch user profile: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return False
    
    # 2. Fetch user preferences
    try:
        print("\n2. Fetching user preferences")
        pref_endpoint = f"{BASE_URL}/api/me/preference"
        print(f"Endpoint: {pref_endpoint}")
        
        response = requests.get(pref_endpoint, headers=headers)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            pref_data = response.json()
            all_data['preferences'] = pref_data
            print("Successfully retrieved user preferences")
        else:
            print(f"Failed to fetch user preferences: {response.text[:200]}")
    except Exception as e:
        print(f"Error fetching user preferences: {e}")
    
    # 3. Fetch user collections
    try:
        print("\n3. Fetching user collections")
        collections_endpoint = f"{BASE_URL}/api/me/collection/"
        print(f"Endpoint: {collections_endpoint}")
        
        response = requests.get(collections_endpoint, headers=headers)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            collections_data = response.json()
            all_data['collections'] = collections_data
            print(f"Found {len(collections_data.get('data', []))} collections")
            
            # Fetch items for each collection
            if 'data' in collections_data and collections_data['data']:
                print("\nFetching items for each collection...")
                for collection in collections_data['data']:
                    collection_uuid = collection.get('uuid')
                    collection_title = collection.get('title')
                    
                    if collection_uuid:
                        items_endpoint = f"{BASE_URL}/api/me/collection/{collection_uuid}/item/"
                        print(f"Fetching items for collection: {collection_title} (UUID: {collection_uuid})")
                        
                        items_response = requests.get(items_endpoint, headers=headers)
                        if items_response.status_code == 200:
                            items_data = items_response.json()
                            collection['items'] = items_data.get('data', [])
                            print(f"  - Retrieved {len(collection['items'])} items")
                        else:
                            print(f"  - Failed to retrieve items. Status: {items_response.status_code}")
                        
                        # Avoid rate limiting
                        time.sleep(0.5)
        else:
            print(f"Failed to fetch collections: {response.text[:200]}")
    except Exception as e:
        print(f"Error fetching collections: {e}")
    
    # 4. Fetch user shelves (most important data)
    shelf_types = ["wish", "doing", "done", "todo", "cancel"]
    all_data['shelves'] = {}
    
    try:
        print("\n4. Fetching user shelves")
        handle = all_data['metadata'].get('handle')
        
        if handle:
            for shelf_type in shelf_types:
                print(f"\nFetching '{shelf_type}' shelf")
                
                # Try both authenticated and public endpoint
                shelf_endpoints = [
                    f"{BASE_URL}/api/me/shelf/{shelf_type}",
                    f"{BASE_URL}/api/user/{handle}/shelf/{shelf_type}"
                ]
                
                for endpoint in shelf_endpoints:
                    print(f"Endpoint: {endpoint}")
                    response = requests.get(endpoint, headers=headers)
                    print(f"Status code: {response.status_code}")
                    
                    if response.status_code == 200:
                        shelf_data = response.json()
                        all_data['shelves'][shelf_type] = shelf_data
                        print(f"Found {len(shelf_data.get('data', []))} items on {shelf_type} shelf")
                        break
                    else:
                        print(f"Failed to fetch {shelf_type} shelf from {endpoint}")
                
                # Avoid rate limiting
                time.sleep(0.5)
        else:
            print("Could not determine user handle, skipping shelf fetching")
    except Exception as e:
        print(f"Error fetching shelves: {e}")
    
    # 5. Fetch user tags
    try:
        print("\n5. Fetching user tags")
        tags_endpoint = f"{BASE_URL}/api/me/tag/"
        print(f"Endpoint: {tags_endpoint}")
        
        response = requests.get(tags_endpoint, headers=headers)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            tags_data = response.json()
            all_data['tags'] = tags_data
            print(f"Found {len(tags_data.get('data', []))} tags")
            
            # Fetch items for each tag
            if 'data' in tags_data and tags_data['data']:
                print("\nFetching items for each tag...")
                for tag in tags_data['data']:
                    tag_uuid = tag.get('uuid')
                    tag_name = tag.get('name')
                    
                    if tag_uuid:
                        tag_items_endpoint = f"{BASE_URL}/api/me/tag/{tag_uuid}/item/"
                        print(f"Fetching items for tag: {tag_name} (UUID: {tag_uuid})")
                        
                        tag_items_response = requests.get(tag_items_endpoint, headers=headers)
                        if tag_items_response.status_code == 200:
                            tag_items_data = tag_items_response.json()
                            tag['items'] = tag_items_data.get('data', [])
                            print(f"  - Retrieved {len(tag['items'])} items")
                        else:
                            print(f"  - Failed to retrieve tag items. Status: {tag_items_response.status_code}")
                        
                        # Avoid rate limiting
                        time.sleep(0.5)
        else:
            print(f"Failed to fetch tags: {response.text[:200]}")
    except Exception as e:
        print(f"Error fetching tags: {e}")
    
    # 6. Fetch user reviews
    try:
        print("\n6. Fetching user reviews")
        reviews_endpoint = f"{BASE_URL}/api/me/review/"
        print(f"Endpoint: {reviews_endpoint}")
        
        response = requests.get(reviews_endpoint, headers=headers)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            reviews_data = response.json()
            all_data['reviews'] = reviews_data
            print(f"Found {len(reviews_data.get('data', []))} reviews")
        else:
            print(f"Failed to fetch reviews: {response.text[:200]}")
    except Exception as e:
        print(f"Error fetching reviews: {e}")
    
    # 7. Fetch trending data for exploration
    try:
        print("\n7. Fetching trending data")
        trending_types = ["book", "movie", "tv", "music", "game", "podcast", "collection"]
        all_data['trending'] = {}
        
        for trending_type in trending_types:
            trending_endpoint = f"{BASE_URL}/api/trending/{trending_type}/"
            print(f"Endpoint: {trending_endpoint}")
            
            response = requests.get(trending_endpoint, headers=headers)
            print(f"Status code: {response.status_code}")
            
            if response.status_code == 200:
                trending_data = response.json()
                all_data['trending'][trending_type] = trending_data
                print(f"Retrieved trending {trending_type} data")
            else:
                print(f"Failed to fetch trending {trending_type}: {response.text[:200]}")
            
            # Avoid rate limiting
            time.sleep(0.5)
    except Exception as e:
        print(f"Error fetching trending data: {e}")
    
    # 8. Check for any notes the user might have
    try:
        # For notes, we need item IDs from shelves or collections
        print("\n8. Checking for notes on items")
        item_uuids = set()
        
        # Collect item UUIDs from shelves
        for shelf_type, shelf in all_data.get('shelves', {}).items():
            if isinstance(shelf, dict) and 'data' in shelf:
                for item in shelf['data']:
                    item_uuid = item.get('item', {}).get('uuid')
                    if item_uuid:
                        item_uuids.add(item_uuid)
        
        print(f"Found {len(item_uuids)} unique items to check for notes")
        
        # Get notes for each item (limit to max 10 to avoid too many requests)
        sample_items = list(item_uuids)[:10]
        all_data['notes'] = {}
        
        for item_uuid in sample_items:
            notes_endpoint = f"{BASE_URL}/api/me/note/item/{item_uuid}/"
            print(f"Checking for notes on item: {item_uuid}")
            
            response = requests.get(notes_endpoint, headers=headers)
            if response.status_code == 200:
                notes_data = response.json()
                if 'data' in notes_data and notes_data['data']:
                    all_data['notes'][item_uuid] = notes_data
                    print(f"  - Found {len(notes_data['data'])} notes")
            
            # Avoid rate limiting
            time.sleep(0.5)
    except Exception as e:
        print(f"Error checking for notes: {e}")
    
    # Save the data
    try:
        output_file = 'data/neodb-data.json'
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        
        print(f"\nData saved to {output_file}")
        
        # Print summary of data collected
        print("\nData collection summary:")
        for key, value in all_data.items():
            if key == 'metadata':
                continue
                
            if isinstance(value, dict):
                if 'data' in value:
                    print(f"- {key}: {len(value['data'])} items")
                else:
                    sub_items = sum(len(sub.get('data', [])) for sub in value.values() if isinstance(sub, dict) and 'data' in sub)
                    print(f"- {key}: {len(value)} categories with {sub_items} total items")
            elif isinstance(value, list):
                print(f"- {key}: {len(value)} items")
            else:
                print(f"- {key}: {type(value).__name__}")
        
        return True
    except Exception as e:
        print(f"Error saving data: {e}")
        return False

if __name__ == "__main__":
    success = fetch_neodb_data()
    sys.exit(0 if success else 1)
