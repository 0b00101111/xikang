# Tags (from user-defined tags or keywords)
    for tag in item.get("keywords", []):
        if isinstance(tag, str):
            tag_id = f"tag-{sanitize_id(tag)}"
            tag_counts[tag_id] += 1
    
    # Second pass: Create nodes and links
    for item in media_items:
        media_type = item.get("type", "Unknown")
        item_id = f"{media_type.lower()}-{sanitize_id(item.get('name', ''))}"
        
        # Extract year from the release date
        year = None
        if "datePublished" in item:
            year_match = re.search(r'\d{4}', item["datePublished"])
            if year_match:
                year = year_match.group(0)
        
        # Add media item node
        extra_data = {
            "rating": item.get("rating"),
            "year": year,
            "date_logged": item.get("date_logged"),
            "url": item.get("url")
        }
        
        # Add media-specific data
        if media_type == "Book":
            extra_data["isbn"] = item.get("isbn")
            extra_data["pages"] = item.get("numberOfPages")
        elif media_type == "Movie" or media_type == "TVSeries":
            extra_data["duration"] = item.get("duration")
        
        add_node(
            item_id, 
            "media", 
            item.get("name", f"Unknown {media_type}"),
            media_type.lower(),
            extra_data
        )
        
        # Process creators
        creators = []
        creator_role = "creator"
        
        if media_type == "Movie":
            creators = item.get("director", [])
            creator_role = "director"
        elif media_type == "Book":
            creators = item.get("author", [])
            creator_role = "author"
        elif media_type == "TVSeries":
            creators = item.get("creator", [])
        elif media_type == "Music":
            creators = item.get("byArtist", []) or item.get("musicBy", [])
            creator_role = "musician"
        elif media_type == "Podcast":
            creators = item.get("author", [])
            creator_role = "host"
        
        for creator in creators:
            if isinstance(creator, dict) and "name" in creator:
                creator_name = creator.get("name", f"Unknown {creator_role.title()}")
                creator_id = f"creator-{sanitize_id(creator_name)}"
                
                # Add creator node
                add_node(
                    creator_id, 
                    "creator", 
                    creator_name,
                    creator_role,
                    {"media_count": creator_counts[creator_id]}
                )
                
                # Add link from media to creator
                links.append({
                    "source": item_id,
                    "target": creator_id,
                    "type": f"{media_type.lower()}-{creator_role}",
                    "value": 3  # Weight for importance in visualization
                })
        
        # Process genres
        for genre in item.get("genre", []):
            if isinstance(genre, str):
                genre_id = f"genre-{sanitize_id(genre)}"
                
                # Add genre node
                add_node(
                    genre_id, 
                    "genre", 
                    genre,
                    None,
                    {"media_count": genre_counts[genre_id]}
                )
                
                # Add link from media to genre
                links.append({
                    "source": item_id,
                    "target": genre_id,
                    "type": f"{media_type.lower()}-genre",
                    "value": 2  # Weight for importance
                })
        
        # Process tags
        for tag in item.get("keywords", []):
            if isinstance(tag, str):
                tag_id = f"tag-{sanitize_id(tag)}"
                
                # Add tag node
                add_node(
                    tag_id, 
                    "tag", 
                    tag,
                    None,
                    {"media_count": tag_counts[tag_id]}
                )
                
                # Add link from media to tag
                links.append({
                    "source": item_id,
                    "target": tag_id,
                    "type": f"{media_type.lower()}-tag",
                    "value": 1  # Lower weight for tags
                })
    
    # Sort nodes by type and category for better organization
    nodes.sort(key=lambda x: (
        # Primary sort by type
        0 if x["type"] == "media" else 
        1 if x["type"] == "creator" else 
        2 if x["type"] == "genre" else 3,
        # Secondary sort by category (for media and creators)
        x.get("category", ""),
        # Tertiary sort by name
        x["name"]
    ))
    
    # Add metadata to the graph
    metadata = {
        "mediaTypes": list(set(node.get("category") for node in nodes if node["type"] == "media" and "category" in node)),
        "creatorTypes": list(set(node.get("category") for node in nodes if node["type"] == "creator" and "category" in node)),
        "lastUpdated": datetime.now().isoformat()
    }
    
    return {
        "nodes": nodes,
        "links": links,
        "metadata": metadata
    }

def sanitize_id(text):
    """Convert text to a safe ID format"""
    if not text:
        return "unknown"
    # Remove special characters and spaces, convert to lowercase
    return re.sub(r'[^a-zA-Z0-9]', '-', text.lower())

if __name__ == "__main__":
    main()
