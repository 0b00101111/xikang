import requests
import json
import os
import sys
import time

def fetch_paginated_data(url, headers, params=None):
    """Fetch all pages of data from the API"""
    if params is None:
        params = {}
    
    all_items = []
    page = 1
    items_per_page = 20  # NeoDB seems to use 20 as default page size
    
    while True:
        current_params = {**params, 'page': page}  # Don't override the default per_page
        print(f"Fetching {url} with params: {current_params}")
        response = requests.get(url, headers=headers, params=current_params)
        
        if response.status_code != 200:
            print(f"Failed to fetch page {page}: {response.text[:200]}")
            break
            
        data = response.json()
        
        # Debug: Print response structure for the first page
        if page == 1:
            print("First page response structure:")
            print(json.dumps({k: v for k, v in data.items() if k != 'data'}, indent=2))
            if data.get('data'):
                print("Sample items structure:")
                for i, item in enumerate(data['data'][:3]):  # Show first 3 items
                    print(f"\nItem {i+1}:")
                    item_type = item.get('item', {}).get('type', 'unknown')
                    item_title = item.get('item', {}).get('title', 'untitled')
                    print(f"Type: {item_type}, Title: {item_title}")
        
        items = data.get('data', [])
        
        if not items:
            print("No more items found")
            break
            
        # Filter for media items if we're not using category parameter
        if 'category' not in params:
            original_count = len(items)
            items = [item for item in items if _is_movie_item(item)]
            print(f"Filtered from {original_count} items to {len(items)} media items")
        
        all_items.extend(items)
        current_count = len(all_items)
        
        # If we got less than items_per_page, we're on the last page
        has_more = len(data.get('data', [])) >= items_per_page  # Check original data length
        print(f"Fetched page {page} ({len(items)} items, total so far: {current_count})")
        
        if not has_more:
            print("Last page reached (got fewer items than page size)")
            break
            
        page += 1
        time.sleep(0.5)  # Rate limiting
    
    print(f"Finished fetching all pages. Total items: {len(all_items)}")
    return all_items

def _is_movie_item(item):
    """Helper function to determine if an item is a movie"""
    def check_media_type(data):
        item_type = data.get('type', '').lower()
        category = data.get('category', '').lower()
        
        # Debug: Print what we're checking
        print(f"Checking type: {item_type}, category: {category}")
        
        # Only include movies, exclude TV shows
        return (
            item_type == 'movie' or
            category == 'movie' or
            (item_type == 'media' and category == 'movie')
        )
    
    # Check the item itself
    if check_media_type(item):
        return True
    
    # Check nested item data
    item_data = item.get('item', {})
    if check_media_type(item_data):
        return True
    
    return False

def fetch_movie_details(movie_uuid, base_url, headers):
    """Fetch detailed movie information including creators"""
    endpoint = f"{base_url}/api/movie/{movie_uuid}"
    print(f"Fetching movie details: {endpoint}")
    
    try:
        response = requests.get(endpoint, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Failed to fetch movie details: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"Error fetching movie details: {e}")
        return None

def process_movie_creators(movie_data, movie_id, creator_nodes, all_data):
    """Process movie creators (directors, playwrights, actors) and add them to the graph"""
    # Process directors
    for director_name in movie_data.get('director', []):
        creator_id = f"director_{hash(director_name)}"
        if creator_id not in creator_nodes:
            creator_nodes[creator_id] = {
                'id': creator_id,
                'name': director_name,
                'type': 'creator',
                'role': 'director'
            }
        all_data['graph_data']['links'].append({
            'source': creator_id,
            'target': movie_id,
            'type': 'directed'
        })
    
    # Process playwrights
    for playwright_name in movie_data.get('playwright', []):
        creator_id = f"playwright_{hash(playwright_name)}"
        if creator_id not in creator_nodes:
            creator_nodes[creator_id] = {
                'id': creator_id,
                'name': playwright_name,
                'type': 'creator',
                'role': 'playwright'
            }
        all_data['graph_data']['links'].append({
            'source': creator_id,
            'target': movie_id,
            'type': 'wrote'
        })
    
    # Process actors (all of them, not just top 5)
    for actor_name in movie_data.get('actor', []):
        creator_id = f"actor_{hash(actor_name)}"
        if creator_id not in creator_nodes:
            creator_nodes[creator_id] = {
                'id': creator_id,
                'name': actor_name,
                'type': 'creator',
                'role': 'actor'
            }
        all_data['graph_data']['links'].append({
            'source': creator_id,
            'target': movie_id,
            'type': 'acted_in'
        })

def fetch_neodb_data():
    # Get all credentials from environment variables
    NEODB_USERNAME = os.environ.get("NEODB_USERNAME")
    NEODB_ACCESS_TOKEN = os.environ.get("NEODB_ACCESS_TOKEN")
    NEODB_CLIENT_ID = os.environ.get("NEODB_CLIENT_ID")
    NEODB_CLIENT_SECRET = os.environ.get("NEODB_CLIENT_SECRET")
    
    # Check required credentials
    missing_vars = []
    for var_name in ["NEODB_USERNAME", "NEODB_ACCESS_TOKEN", "NEODB_CLIENT_ID", "NEODB_CLIENT_SECRET"]:
        if not os.environ.get(var_name):
            missing_vars.append(var_name)
    
    if missing_vars:
        print("Error: Missing required environment variables:", ", ".join(missing_vars))
        return False
    
    print(f"Fetching NeoDB movie data for user: {NEODB_USERNAME}")
    
    # Base URL for the API
    BASE_URL = "https://neodb.social"
    
    # Setup headers with full authorization
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; MovieDataFetcher/1.0)',
        'Accept': 'application/json',
        'Authorization': f"Bearer {NEODB_ACCESS_TOKEN}",
        'X-Client-ID': NEODB_CLIENT_ID
    }
    
    # Initialize data structure
    all_data = {
        'metadata': {
            'username': NEODB_USERNAME,
            'fetch_time': time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
            'client_id': NEODB_CLIENT_ID
        },
        'graph_data': {
            'nodes': [],
            'links': []
        }
    }
    
    # Verify user profile
    try:
        print("\n1. Verifying user profile")
        response = requests.get(f"{BASE_URL}/api/me", headers=headers)
        if response.status_code != 200:
            print(f"Failed to verify user: {response.text[:200]}")
            return False
        user_data = response.json()
        all_data['metadata']['display_name'] = user_data.get('display_name', NEODB_USERNAME)
    except Exception as e:
        print(f"Error verifying user: {e}")
        return False
    
    # Fetch movies from each shelf with pagination
    shelf_types = ["wishlist", "progress", "complete", "dropped"]
    movie_nodes = {}  # Keep track of unique movies
    creator_nodes = {}  # Keep track of unique creators
    
    for shelf_type in shelf_types:
        try:
            print(f"\n2. Fetching movies from '{shelf_type}' shelf")
            endpoint = f"{BASE_URL}/api/me/shelf/{shelf_type}"
            
            # Try first with type=movie
            params = {'type': 'movie'}
            items = fetch_paginated_data(endpoint, headers, params)
            
            if not items:
                # If no items found, try with category=movie
                print("Retrying with category=movie parameter...")
                params = {'category': 'movie'}
                items = fetch_paginated_data(endpoint, headers, params)
            
            if not items:
                # If still no items, try without filter and let the code filter movies
                print("Retrying without category filter...")
                items = fetch_paginated_data(endpoint, headers)
            
            print(f"Found {len(items)} movies on {shelf_type} shelf")
            
            # Process each movie
            for item in items:
                movie_data = item.get('item', {})
                movie_id = movie_data.get('uuid')
                
                if not movie_id:
                    continue
                
                # Create or update movie node
                if movie_id not in movie_nodes:
                    # Fetch detailed movie information
                    detailed_data = fetch_movie_details(movie_id, BASE_URL, headers)
                    if detailed_data:
                        movie_nodes[movie_id] = {
                            'id': movie_id,
                            'name': detailed_data.get('title', 'Untitled Movie'),
                            'type': 'movie',
                            'shelf': shelf_type,
                            'data': {
                                'url': detailed_data.get('url'),
                                'imdb': detailed_data.get('imdb'),
                                'year': detailed_data.get('year'),
                                'genre': detailed_data.get('genre', []),
                                'area': detailed_data.get('area', []),
                                'language': detailed_data.get('language', []),
                                'duration': detailed_data.get('duration'),
                                'rating': item.get('rating'),
                                'comment': item.get('comment'),
                                'description': detailed_data.get('description')
                            }
                        }
                        
                        # Process creators from detailed data
                        process_movie_creators(detailed_data, movie_id, creator_nodes, all_data)
                    else:
                        # Fallback to basic data if detailed fetch fails
                        movie_nodes[movie_id] = {
                            'id': movie_id,
                            'name': movie_data.get('title', 'Untitled Movie'),
                            'type': 'movie',
                            'shelf': shelf_type,
                            'data': {
                                'url': movie_data.get('url'),
                                'rating': item.get('rating'),
                                'comment': item.get('comment')
                            }
                        }
                
                # Link to shelf
                all_data['graph_data']['links'].append({
                    'source': f"shelf_{shelf_type}",
                    'target': movie_id,
                    'type': 'contains'
                })
                
                # Add small delay between movie detail requests
                time.sleep(0.2)
        
        except Exception as e:
            print(f"Error processing {shelf_type} shelf: {e}")
    
    # Add all nodes to the graph
    # First add shelf nodes
    for shelf_type in shelf_types:
        all_data['graph_data']['nodes'].append({
            'id': f"shelf_{shelf_type}",
            'name': shelf_type.capitalize(),
            'type': 'shelf',
            'group': 'shelf'
        })
    
    # Then add movie nodes
    all_data['graph_data']['nodes'].extend(movie_nodes.values())
    
    # Finally add creator nodes
    all_data['graph_data']['nodes'].extend(creator_nodes.values())
    
    # Save the data
    output_file = "data/neodb-data.json"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print(f"\nData saved to {output_file}")
    print(f"Total movies: {len(movie_nodes)}")
    print(f"Total creators: {len(creator_nodes)}")
    print(f"Total links: {len(all_data['graph_data']['links'])}")
    
    return True

if __name__ == "__main__":
    fetch_neodb_data()
