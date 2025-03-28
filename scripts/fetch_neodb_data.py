#!/usr/bin/env python3
import requests
import json
import os
import re
from datetime import datetime
from collections import defaultdict

# Configuration - get username from environment variable or use default
NEODB_USERNAME = os.environ.get("NEODB_USERNAME", "your_username")
OUTPUT_PATH = "data/neodb-data.json"
API_BASE_URL = "https://neodb.social"

# Media types to fetch
MEDIA_TYPES = ["Movie", "Book", "TVSeries", "Music", "Podcast"]

def main():
    """Main function to fetch and process NeoDB data"""
    print(f"Fetching media data for user: {NEODB_USERNAME}")
    
    # Create the output directory if it doesn't exist
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    # Fetch media items
    media_items = fetch_media_data()
    
    if media_items:
        # Process the items into a graph structure
        graph_data = transform_to_graph(media_items)
        
        # Save the processed data
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(graph_data, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully saved media data to {OUTPUT_PATH}")
        print(f"Processed {len(media_items)} items into {len(graph_data['nodes'])} nodes and {len(graph_data['links'])} links")
        
        # Print stats for each media type
        media_counts = {}
        for item in media_items:
            media_type = item.get("type", "Unknown")
            media_counts[media_type] = media_counts.get(media_type, 0) + 1
        
        print("Media type counts:")
        for media_type, count in media_counts.items():
            print(f"  {media_type}: {count}")
            
        return True
    else:
        print("No media data found")
        
        # If no data was found, create a minimal valid file
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump({
                "nodes": [], 
                "links": [],
                "metadata": {
                    "mediaTypes": [],
                    "creatorTypes": [],
                    "lastUpdated": datetime.now().isoformat()
                }
            }, f, ensure_ascii=False)
            
        return False

def fetch_media_data():
    """Fetch media data from NeoDB"""
    media_items = []
    
    try:
        # Try the outbox approach first
        outbox_url = f"{API_BASE_URL}/users/{NEODB_USERNAME}/outbox"
        outbox_items = fetch_from_outbox(outbox_url)
        if outbox_items:
            media_items.extend(outbox_items)
            print(f"Found {len(outbox_items)} items from outbox")
        
        # Try the collection approach next
        collection_url = f"{API_BASE_URL}/users/{NEODB_USERNAME}/collections"
        collection_items = fetch_from_collection(collection_url)
        if collection_items:
            # Avoid duplicates by checking IDs
            existing_ids = set(item.get("id") for item in media_items if "id" in item)
            unique_collection_items = [item for item in collection_items if item.get("id") not in existing_ids]
            
            media_items.extend(unique_collection_items)
            print(f"Found {len(unique_collection_items)} additional items from collections")
        
        return media_items
    
    except Exception as e:
        print(f"Error fetching media data: {e}")
        return []

def fetch_from_outbox(outbox_url):
    """Fetch media items from user's outbox (activities)"""
    try:
        response = requests.get(outbox_url)
        response.raise_for_status()
        data = response.json()
        
        media_items = []
        
        # Look for activities in the outbox
        if "orderedItems" in data:
            for activity in data["orderedItems"]:
                # Check for reviews and ratings
                if activity.get("type") == "Create" and activity.get("object", {}).get("type") == "Review":
                    media_item = activity["object"].get("item", {})
                    if media_item.get("type") in MEDIA_TYPES:
                        # Add the review rating and date
                        media_item["rating"] = activity["object"].get("rating", {}).get("ratingValue")
                        media_item["date_logged"] = activity.get("published")
                        media_items.append(media_item)
                
                # Check for Check-in activities
                elif activity.get("type") == "CheckIn":
                    media_item = activity.get("item", {})
                    if media_item.get("type") in MEDIA_TYPES:
                        media_item["date_logged"] = activity.get("published")
                        media_items.append(media_item)
        
        return media_items
    
    except Exception as e:
        print(f"Error fetching from outbox: {e}")
        return []

def fetch_from_collection(collection_url):
    """Fetch media items from the user's collections"""
    try:
        # Fetch the list of collections
        response = requests.get(collection_url)
        response.raise_for_status()
        collections_data = response.json()
        
        media_items = []
        
        # Process each collection
        if "items" in collections_data:
            for collection in collections_data["items"]:
                collection_id = collection.get("id")
                collection_name = collection.get("name", "Unknown Collection")
                
                if collection_id:
                    print(f"Fetching items from collection: {collection_name}")
                    
                    # Fetch items in this collection
                    items_url = f"{collection_id}/items"
                    try:
                        items_response = requests.get(items_url)
                        items_response.raise_for_status()
                        items_data = items_response.json()
                        
                        # Extract media items
                        if "items" in items_data:
                            for item in items_data["items"]:
                                if item.get("type") in MEDIA_TYPES:
                                    # Add collection info to the item
                                    item["collection"] = {
                                        "name": collection_name,
                                        "id": collection_id
                                    }
                                    media_items.append(item)
                    
                    except Exception as e:
                        print(f"Error fetching items from collection {collection_name}: {e}")
        
        return media_items
    
    except Exception as e:
        print(f"Error fetching collections: {e}")
        return []

def transform_to_graph(media_items):
    """Transform media data into a graph structure for D3.js visualization"""
    nodes = []
    links = []
    
    # Keep track of nodes to avoid duplicates
    node_ids = set()
    
    # Helper function to add a node if it doesn't exist
    def add_node(node_id, node_type, name, category=None, extra_data=None):
        if node_id not in node_ids:
            node = {
                "id": node_id,
                "type": node_type,
                "name": name
            }
            
            if category:
                node["category"] = category
                
            # Add any extra data to the node
            if extra_data:
                node.update(extra_data)
                
            nodes.append(node)
            node_ids.add(node_id)
    
    # Track counts for entities
    creator_counts = defaultdict(int)
    genre_counts = defaultdict(int)
    tag_counts = defaultdict(int)
    
    # First pass: Count occurrences of creators, genres, tags
    for item in media_items:
        media_type = item.get("type", "Unknown")
        
        # Creators (authors, directors, etc.)
        creators = []
        creator_type = "creator"
        
        if media_type == "Movie":
            creators = item.get("director", [])
            creator_type = "director"
        elif media_type == "Book":
            creators = item.get("author", [])
            creator_type = "author"
        elif media_type == "TVSeries":
            creators = item.get("creator", [])
        elif media_type == "Music":
            creators = item.get("byArtist", []) or item.get("musicBy", [])
            creator_type = "musician"
        elif media_type == "Podcast":
            creators = item.get("author", [])
            creator_type = "host"
        
        for creator in creators:
            if isinstance(creator, dict) and "name" in creator:
                creator_id = f"creator-{sanitize_id(creator['name'])}"
                creator_counts[creator_id] += 1
            
        # Genres
        for genre in item.get("genre", []):
            if isinstance(genre, str):
                genre_id = f"genre-{sanitize_id(genre)}"
                genre_counts[genre_id] += 1
            
        # Tags (from user-defined tags or keywords)
        for tag in item.get("keywords", []):
            if isinstance
