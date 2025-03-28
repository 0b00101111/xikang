import requests
import json
import os
import sys
import time

def _process_movie_item(item):
    """Process a movie item and return its node and links data"""
    movie_id = f"movie_{item['id']}"
    movie_node = {
        "id": movie_id,
        "name": item.get('title', ''),
        "type": "movie",
        "category": "movie",
        "data": {
            "rating": item.get('rating', {}).get('value'),
            "url": item.get('url', '')
        }
    }
    
    links = []
    nodes = [movie_node]
    
    # Process shelf status
    shelf = item.get('status', 'unknown')
    if shelf:
        shelf_id = f"shelf_{shelf}"
        links.append({
            "source": movie_id,
            "target": shelf_id,
            "type": "in_shelf"
        })
    
    # Process directors
    directors = item.get('directors', [])
    for director in directors:
        director_id = f"person_{director['id']}"
        nodes.append({
            "id": director_id,
            "name": director.get('name', ''),
            "type": "person"
        })
        links.append({
            "source": director_id,
            "target": movie_id,
            "type": "directed"
        })
    
    # Process actors (limit to top 5)
    actors = item.get('actors', [])[:5]  # Limit to top 5 actors
    for actor in actors:
        actor_id = f"person_{actor['id']}"
        nodes.append({
            "id": actor_id,
            "name": actor.get('name', ''),
            "type": "person"
        })
        links.append({
            "source": actor_id,
            "target": movie_id,
            "type": "acted_in"
        })
    
    # Process playwrights
    playwrights = item.get('playwrights', [])
    for playwright in playwrights:
        playwright_id = f"person_{playwright['id']}"
        nodes.append({
            "id": playwright_id,
            "name": playwright.get('name', ''),
            "type": "person"
        })
        links.append({
            "source": playwright_id,
            "target": movie_id,
            "type": "wrote"
        })
    
    return nodes, links

def fetch_paginated_data(api_url, headers, params=None):
    """Fetch paginated data from the API"""
    if params is None:
        params = {}
    
    all_items = []
    page = 1
    page_size = 50  # Default page size
    
    while True:
        current_params = {
            **params,
            'page': page,
            'page_size': page_size
        }
        
        response = requests.get(api_url, headers=headers, params=current_params)
        if response.status_code != 200:
            print(f"Error fetching page {page}: {response.status_code}")
            break
            
        data = response.json()
        items = data.get('data', [])
        
        # Filter for movie items
        movie_items = [item for item in items if _is_movie_item(item)]
        print(f"Filtered from {len(items)} items to {len(movie_items)} media items")
        
        all_items.extend(movie_items)
        print(f"Fetched page {page} ({len(movie_items)} items, total so far: {len(all_items)})")
        
        # Check if we've reached the last page
        if len(items) < page_size:
            print("Last page reached (got fewer items than page size)")
            break
            
        page += 1
    
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
    
    # Process actors (limit to top 5)
    actors = movie_data.get('actor', [])[:5]  # Limit to top 5 actors
    for actor_name in actors:
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
            endpoint = f"{BASE_URL}/api/me/shelf/movie"  # Changed to explicitly use movie endpoint
            
            # Use shelf parameter
            params = {'shelf': shelf_type}
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
            print(f"Error processing {shelf_type} shelf: {str(e)}")
            print(f"Full error: {e}")
    
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
