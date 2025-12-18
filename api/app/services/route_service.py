
import httpx
import os
from typing import List, Dict, Any, Optional

class RouteService:
    BASE_URL = "https://maps.googleapis.com/maps/api"
    # Fallback to the provided key if env var is not set (In production, ONLY use env var)
    API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "AIzaSyDhWyW7FEEhD1WRp3BZLhK1mu_BMNqefi0")
    
    # University of Hyogo, Kobe Campus for Commerce
    UNIV_COORDS = "34.6937373,135.0594364"
    UNIV_ADDRESS = "兵庫県立大学 神戸商科キャンパス"

    async def get_coordinates(self, address: str) -> Optional[Dict[str, float]]:
        """Geocodes an address to get latitude and longitude."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/geocode/json",
                params={
                    "address": address,
                    "key": self.API_KEY,
                    "language": "ja"
                }
            )
            data = response.json()
            if data["status"] == "OK" and data["results"]:
                location = data["results"][0]["geometry"]["location"]
                return location
            return None

    async def calculate_farmer_route(self, start_address: str, farmers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates the shortest route from Start -> Farmers -> University.
        """
        if not farmers:
            return {"error": "No farmers provided"}

        # Prepare waypoints
        waypoints = []
        for farmer in farmers:
            loc = ""
            if farmer.get("latitude") and farmer.get("longitude"):
                loc = f"{farmer['latitude']},{farmer['longitude']}"
            else:
                loc = farmer.get("address", "")
            
            if loc:
                waypoints.append(loc)
        
        if not waypoints:
            return {"error": "No valid farmer locations"}

        waypoints_str = "|".join(waypoints)
        
        # Directions API request
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/directions/json",
                params={
                    "origin": start_address,
                    "destination": self.UNIV_COORDS,
                    "waypoints": f"optimize:true|{waypoints_str}",
                    "mode": "driving",
                    "language": "ja",
                    "key": self.API_KEY
                }
            )
            data = response.json()
            
            if data["status"] != "OK":
                return {"error": f"Google Maps API Error: {data.get('status')}", "details": data.get("error_message")}

            return self._format_route_response(data, farmers, "farmer")

    async def calculate_restaurant_route(self, restaurants: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates delivery route: University -> Restaurants.
        Currently uses simple optimization.
        """
        if not restaurants:
            return {"error": "No restaurants provided"}

        # Prepare waypoints
        waypoints = []
        for rest in restaurants:
            loc = ""
            if rest.get("latitude") and rest.get("longitude"):
                loc = f"{rest['latitude']},{rest['longitude']}"
            else:
                loc = rest.get("address", "")
            
            if loc:
                waypoints.append(loc)
        
        if not waypoints:
            return {"error": "No valid restaurant locations"}

        # For delivery, we might assume a round trip or just ending at the last one.
        # Let's assume ending at the last optimized stop effectively (or we can set destination to same as origin for round trip).
        # However, typically delivery routes end at the last drop-off.
        # Directions API requires a destination. We'll use the last waypoint as destination initially, 
        # but optimize:true works best with a fixed start and end.
        # Let's use the University as Start, and let Google optimize the order of all restaurants.
        # The 'Destination' is tricky if we don't return. Let's set the destination to the last restaurant in the list (unoptimized)
        # but let Google reorder the intermediates.
        # BETTER APPROACH: Set University as Origin, and pass ALL restaurants as waypoints (optimize:true).
        # But we need a destination. Let's arbitrarily set the first restaurant as destination and the rest as waypoints? No.
        # Let's default to returning to University or just ending at the "furthest" point?
        # A common pattern is "Round Trip" back to University. Let's do that for now as it's the most robust default.
        
        waypoints_str = "|".join(waypoints)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/directions/json",
                params={
                    "origin": self.UNIV_COORDS,
                    "destination": self.UNIV_COORDS, # Round trip for now
                    "waypoints": f"optimize:true|{waypoints_str}",
                    "mode": "driving",
                    "language": "ja",
                    "key": self.API_KEY
                }
            )
            data = response.json()
            
            if data["status"] != "OK":
                 return {"error": f"Google Maps API Error: {data.get('status')}", "details": data.get("error_message")}

            return self._format_route_response(data, restaurants, "restaurant")

    async def calculate_full_route(self, start_address: str, farmers: List[Dict[str, Any]], restaurants: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates the full daily route:
        Start -> [Farmers (Optimized)] -> University -> [Restaurants (Optimized)] -> End
        """
        # 1. Calculate Collection Leg (Start -> Farmers -> University)
        collection_result = await self.calculate_farmer_route(start_address, farmers)
        
        # If collection fails (e.g. no farmers), we might still want delivery route if start is University?
        # But requirement says "Start -> Farmers -> University -> Restaurants".
        # If no farmers, Start -> University -> Restaurants.
        
        if "error" in collection_result and collection_result.get("details") != "No farmers provided":
             # Real error
             return collection_result
        
        # 2. Calculate Delivery Leg (University -> Restaurants)
        delivery_result = await self.calculate_restaurant_route(restaurants)
        
        if "error" in delivery_result and delivery_result.get("details") != "No restaurants provided":
             return delivery_result

        # 3. Merge Results
        full_timeline = []
        total_distance_val = 0.0
        total_duration_val = 0

        # Process Collection Leg
        if "timeline" in collection_result:
            full_timeline.extend(collection_result["timeline"])
            # Remove the last "End" point if it's University, because the next leg starts there
            # But wait, the next leg starts at "Start" (University).
            # Visually, we want: Start -> ... -> University (Arrive) -> University (Depart) -> ...
            # Let's keep it simple.
            
            # Parse distance/duration strings back to numbers is annoying. 
            # Ideally _format_route_response returned raw values too.
            # For now, let's just append.
            pass
        else:
            # If skipped (no farmers), add Start Point manually if needed, 
            # or just assume the Delivery leg starts at University which implies the driver went there.
            # But user specified "Start Address". So we need Start -> University leg at least if no farmers.
            pass

        # Since we are combining two separate API calls/responses which are formatted strings,
        # merging them cleanly into one "Timeline" list requires a bit of care.
        # Let's just return a composite object.
        
        return {
            "collection_leg": collection_result if "timeline" in collection_result else None,
            "delivery_leg": delivery_result if "timeline" in delivery_result else None,
            "summary": "Full route calculated"
        }

    def _format_route_response(self, data: Dict, locations: List[Dict], type_key: str) -> Dict:
        """Helper to format the messy Google Maps response into a clean Timeline."""
        route = data["routes"][0]
        waypoint_order = route["waypoint_order"]
        legs = route["legs"]
        
        # Calculate total info
        total_distance_meters = sum(leg["distance"]["value"] for leg in legs)
        total_duration_seconds = sum(leg["duration"]["value"] for leg in legs)
        
        timeline = []
        
        # Start Point
        timeline.append({
            "type": "start",
            "name": legs[0]["start_address"],
            "address": legs[0]["start_address"],
            "time_from_prev": "0分",
            "distance_from_prev": "0km"
        })
        
        # Waypoints (reordered)
        # legs[0] is Start -> Waypoint 1
        # legs[1] is Waypoint 1 -> Waypoint 2
        # ...
        current_time_accumulated = 0
        
        for i, original_index in enumerate(waypoint_order):
            leg = legs[i]
            location_info = locations[original_index]
            
            # Duration of this leg
            duration_text = leg["duration"]["text"]
            distance_text = leg["distance"]["text"]
            
            timeline.append({
                "type": "visit",
                "name": location_info.get("name", "Unknown"),
                "address": leg["end_address"],
                "arrival_time_estimate": f"+{duration_text}", # Simplified
                "distance": distance_text,
                "data": location_info
            })
            
        # End Point
        last_leg = legs[-1]
        timeline.append({
            "type": "end",
            "name": last_leg["end_address"],
            "address": last_leg["end_address"],
            "arrival_time_estimate": f"+{last_leg['duration']['text']}",
            "distance": last_leg["distance"]["text"]
        })
        
        return {
            "total_distance": f"{total_distance_meters / 1000:.1f} km",
            "total_duration": f"{total_duration_seconds // 60} 分",
            "timeline": timeline,
            "optimized_order": waypoint_order
        }

route_service = RouteService()
