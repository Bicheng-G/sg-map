import requests
import json
import time

def download_singapore_roads():
    # Overpass API endpoint
    overpass_url = "https://overpass-api.de/api/interpreter"
    
    # Query to get all roads in Singapore
    overpass_query = """
    [out:json][timeout:250];
    area(3617140517)->.singapore;
    (
      way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|service|track)$"](area.singapore);
    );
    out body;
    >;
    out skel qt;
    """
    
    # Make the request
    response = requests.post(overpass_url, data=overpass_query)
    
    if response.status_code == 200:
        # Save the response to a file
        with open('singapore_roads.json', 'w', encoding='utf-8') as f:
            json.dump(response.json(), f, indent=2)
        print("Successfully downloaded Singapore road data")
    else:
        print(f"Error downloading data: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    download_singapore_roads() 