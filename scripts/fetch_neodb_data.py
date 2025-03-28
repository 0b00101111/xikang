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
        },
        'graph_data': {
            'nodes': [],
            'links': []
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
                
                # Add user as a central node in the graph
                all_data['graph_data']['nodes'].append({
                    'id': 'user',
                    'name': user_data.get('display_name', 'User'),
                    'type': 'user',
                    'group': 'center',
                    'size': 25
                })
        else:
            print(f"Failed to fetch user profile: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return False
    
    # 2. Fetch user tags (focus on these as they're returning data)
    try:
        print("\n2. Fetching user tags")
        tags_endpoint = f"{BASE_URL}/api/me/tag/"
        print(f"Endpoint: {tags_endpoint}")
        
        response = requests.get(tags_endpoint, headers=headers)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            tags_data = response.json()
            all_data['tags'] = tags_data
            
            tag_count = len(tags_data.get('data', []))
            print(f"Found {tag_count} tags")
            
            # Add tags as nodes in the graph
            for i, tag in enumerate(tags_data.get('data', [])):
                tag_uuid = tag.get('uuid')
                tag_name = tag.get('name')
                
                if tag_uuid:
                    # Add this tag as a node
                    all_data['graph_data']['nodes'].append({
                        'id': f"tag_{tag_uuid}",
                        'name': tag_name or f"Tag {i+1}",
                        'type': 'tag',
                        'group': 'tag',
                        'size': 10
                    })
                    
                    # Link this tag to the user
                    all_data['graph_data']['links'].append({
                        'source': 'user',
                        'target': f"tag_{tag_uuid}",
                        'type': 'has_tag',
                        'value': 2
                    })
                    
                    # Fetch items for each tag
                    if tag_uuid:
                        tag_items_endpoint = f"{BASE_URL}/api/me/tag/{tag_uuid}/item/"
                        print(f"Fetching items for tag: {tag_name or tag_uuid}")
                        
                        tag_items_response = requests.get(tag_items_endpoint, headers=headers)
                        if tag_items_response.status_code == 200:
                            tag_items_data = tag_items_response.json()
                            tag['items'] = tag_items_data.get('data', [])
                            item_count = len(tag['items'])
                            print(f"  - Retrieved {item_count} items")
                            
                            # Add items as nodes
                            for item in tag['items']:
                                item_uuid = item.get('uuid') or item.get('item', {}).get('uuid')
                                item_title = item.get('title') or item.get('item', {}).get('title')
                                item_type = item.get('type') or item.get('item', {}).get('type')
                                
                                if item_uuid:
                                    # Check if this item node already exists
                                    exists = False
                                    for node in all_data['graph_data']['nodes']:
                                        if node['id'] == f"item_{item_uuid}":
                                            exists = True
                                            break
                                    
                                    # Add the item node if it doesn't exist
                                    if not exists:
                                        all_data['graph_data']['nodes'].append({
                                            'id': f"item_{item_uuid}",
                                            'name': item_title or f"Item {item_uuid[:8]}",
                                            'type': item_type or 'unknown',
                                            'group': item_type or 'item',
                                            'size': 5,
                                            'data': item
                                        })
                                    
                                    # Link this item to the tag
                                    all_data['graph_data']['links'].append({
                                        'source': f"tag_{tag_uuid}",
                                        'target': f"item_{item_uuid}",
                                        'type': 'contains',
                                        'value': 1
                                    })
                        else:
                            print(f"  - Failed to retrieve tag items. Status: {tag_items_response.status_code}")
                        
                        # Avoid rate limiting
                        time.sleep(0.5)
        else:
            print(f"Failed to fetch tags: {response.text[:200]}")
    except Exception as e:
        print(f"Error fetching tags: {e}")
    
    # 3. Fetch shelf data using the correct shelf types according to the API documentation
    try:
        print("\n3. Fetching shelf data with correct types")
        
        # The correct shelf types according to the API documentation
        shelf_types = ["wishlist", "progress", "complete", "dropped"]
        categories = ["book", "movie", "tv", "album", "game", "podcast"]
        
        all_data['shelf_items'] = {}
        total_shelf_items = 0
        
        # Create a node for each shelf type
        for shelf_type in shelf_types:
            all_data['graph_data']['nodes'].append({
                'id': f"shelf_{shelf_type}",
                'name': shelf_type.capitalize(),
                'type': 'shelf',
                'group': 'shelf',
                'size': 15
            })
            
            # Link shelf to user
            all_data['graph_data']['links'].append({
                'source': 'user',
                'target': f"shelf_{shelf_type}",
                'type': 'has_shelf',
                'value': 3
            })
        
        # Fetch each shelf type
        for shelf_type in shelf_types:
            print(f"\nFetching '{shelf_type}' shelf")
            
            # Try with and without category parameter
            all_endpoint = f"{BASE_URL}/api/me/shelf/{shelf_type}"
            print(f"Fetching all items: {all_endpoint}")
            
            response = requests.get(all_endpoint, headers=headers)
            print(f"Status code: {response.status_code}")
            
            if response.status_code == 200:
                items_data = response.json()
                
                if isinstance(items_data, dict) and 'data' in items_data:
                    key = f"all_{shelf_type}"
                    all_data['shelf_items'][key] = items_data
                    item_count = len(items_data['data'])
                    total_shelf_items += item_count
                    print(f"  - Found {item_count} items on '{shelf_type}' shelf")
                    
                    # Add these items to the graph
                    for item in items_data['data']:
                        item_data = item.get('item', {})
                        item_uuid = item_data.get('uuid')
                        item_title = item_data.get('title')
                        item_type = item_data.get('category') or item_data.get('type')
                        
                        if item_uuid:
                            # Check if this item node already exists
                            exists = False
                            for node in all_data['graph_data']['nodes']:
                                if node['id'] == f"item_{item_uuid}":
                                    exists = True
                                    break
                            
                            # Add the item node if it doesn't exist
                            if not exists:
                                all_data['graph_data']['nodes'].append({
                                    'id': f"item_{item_uuid}",
                                    'name': item_title or f"Item {item_uuid[:8]}",
                                    'type': item_type or 'unknown',
                                    'group': item_type or 'item',
                                    'status': shelf_type,
                                    'size': 5,
                                    'data': item
                                })
                            
                            # Link this item to its shelf
                            all_data['graph_data']['links'].append({
                                'source': f"shelf_{shelf_type}",
                                'target': f"item_{item_uuid}",
                                'type': 'contains',
                                'value': 1
                            })
            else:
                print(f"  - Failed to fetch items. Status: {response.status_code}")
            
            # Now try with specific categories
            for category in categories:
                category_endpoint = f"{BASE_URL}/api/me/shelf/{shelf_type}?category={category}"
                print(f"Fetching {category} items: {category_endpoint}")
                
                cat_response = requests.get(category_endpoint, headers=headers)
                print(f"Status code: {cat_response.status_code}")
                
                if cat_response.status_code == 200:
                    cat_items_data = cat_response.json()
                    
                    if isinstance(cat_items_data, dict) and 'data' in cat_items_data and cat_items_data['data']:
                        key = f"{category}_{shelf_type}"
                        all_data['shelf_items'][key] = cat_items_data
                        item_count = len(cat_items_data['data'])
                        print(f"  - Found {item_count} {category} items with status '{shelf_type}'")
                
                # Avoid rate limiting
                time.sleep(0.3)
        
        print(f"\nTotal shelf items found: {total_shelf_items}")
    except Exception as e:
        print(f"Error fetching shelf items: {e}")
    
    # Save the data
    try:
        output_file = 'data/neodb-data.json'
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        
        print(f"\nData saved to {output_file}")
        
        # Print summary of graph data
        nodes_count = len(all_data['graph_data']['nodes'])
        links_count = len(all_data['graph_data']['links'])
        print(f"\nGraph data created: {nodes_count} nodes and {links_count} links")
        
        # Print grouped counts
        node_types = {}
        for node in all_data['graph_data']['nodes']:
            node_type = node.get('type', 'unknown')
            node_types[node_type] = node_types.get(node_type, 0) + 1
        
        print("\nNode types in graph:")
        for node_type, count in node_types.items():
            print(f"- {node_type}: {count} nodes")
        
        return True
    except Exception as e:
        print(f"Error saving data: {e}")
        return False

if __name__ == "__main__":
    success = fetch_neodb_data()
    sys.exit(0 if success else 1)
