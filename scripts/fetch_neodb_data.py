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
    total_count = None
    
    while True:
        current_params = {**params, 'page': page, 'per_page': 100}
        print(f"Fetching {url} with params: {current_params}")
        response = requests.get(url, headers=headers, params=current_params)
        
        if response.status_code != 200:
            print(f"Failed to fetch page {page}: {response.text[:200]}")
            break
            
        data = response.json()
        
        # Debug: Print pagination info
        pagination = data.get('pagination', {})
        print(f"Pagination info: {pagination}")
        
        # Get total count from the first response
        if total_count is None:
            total_count = pagination.get('total', 0)
            print(f"Total items to fetch: {total_count}")
        
        items = data.get('data', [])
        
        if not items:
            print("No more items found")
            break
            
        all_items.extend(items)
        current_count = len(all_items)
        
        print(f"Fetched page {page} ({len(items)} items, {current_count}/{total_count} total)")
        
        if current_count >= total_count or len(items) == 0:
            break
            
        page += 1
        time.sleep(0.5)  # Rate limiting
    
    return all_items

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
            params = {'category': 'movie'}
            
            # Fetch all pages for this shelf
            items = fetch_paginated_data(endpoint, headers, params)
            print(f"Found {len(items)} movies on {shelf_type} shelf")
            
            # Process each movie
            for item in items:
                movie_data = item.get('item', {})
                movie_id = movie_data.get('uuid')
                
                if not movie_id:
                    continue
                
                # Create or update movie node
                if movie_id not in movie_nodes:
                    movie_nodes[movie_id] = {
                        'id': movie_id,
                        'name': movie_data.get('title', 'Untitled Movie'),
                        'type': 'movie',
                        'shelf': shelf_type,
                        'data': {
                            'url': movie_data.get('url'),
                            'release_date': movie_data.get('release_date'),
                            'description': movie_data.get('description'),
                            'rating': item.get('rating'),
                            'comment': item.get('comment')
                        }
                    }
                
                # Process creators (directors, writers, actors)
                credits = movie_data.get('credits', {})
                
                # Process directors
                for director in credits.get('director', []):
                    creator_id = f"director_{director['uuid']}" if 'uuid' in director else f"director_{hash(director['name'])}"
                    if creator_id not in creator_nodes:
                        creator_nodes[creator_id] = {
                            'id': creator_id,
                            'name': director['name'],
                            'type': 'creator',
                            'role': 'director'
                        }
                    all_data['graph_data']['links'].append({
                        'source': creator_id,
                        'target': movie_id,
                        'type': 'directed'
                    })
                
                # Process writers
                for writer in credits.get('writer', []):
                    creator_id = f"writer_{writer['uuid']}" if 'uuid' in writer else f"writer_{hash(writer['name'])}"
                    if creator_id not in creator_nodes:
                        creator_nodes[creator_id] = {
                            'id': creator_id,
                            'name': writer['name'],
                            'type': 'creator',
                            'role': 'writer'
                        }
                    all_data['graph_data']['links'].append({
                        'source': creator_id,
                        'target': movie_id,
                        'type': 'wrote'
                    })
                
                # Process actors (limit to main cast)
                for actor in credits.get('cast', [])[:5]:  # Limit to top 5 cast members
                    creator_id = f"actor_{actor['uuid']}" if 'uuid' in actor else f"actor_{hash(actor['name'])}"
                    if creator_id not in creator_nodes:
                        creator_nodes[creator_id] = {
                            'id': creator_id,
                            'name': actor['name'],
                            'type': 'creator',
                            'role': 'actor'
                        }
                    all_data['graph_data']['links'].append({
                        'source': creator_id,
                        'target': movie_id,
                        'type': 'acted_in'
                    })
                
                # Link to shelf
                all_data['graph_data']['links'].append({
                    'source': f"shelf_{shelf_type}",
                    'target': movie_id,
                    'type': 'contains'
                })
        
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
