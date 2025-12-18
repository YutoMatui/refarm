import sys
import os

# Set up path to allow imports
sys.path.append(os.path.abspath("webapp/api"))

try:
    from app.models.farmer import Farmer
    from app.schemas.farmer import FarmerBase
    from app.routers.orders import router
    
    print("Successfully imported modules.")
    
    # Check Farmer Model
    farmer = Farmer()
    if hasattr(farmer, 'latitude') and hasattr(farmer, 'longitude'):
        print("PASS: Farmer model has latitude and longitude.")
    else:
        print("FAIL: Farmer model missing latitude or longitude.")
        
    # Check Farmer Schema
    schema = FarmerBase(name="Test", phone_number="123", address="Addr")
    if 'latitude' in schema.model_fields and 'longitude' in schema.model_fields:
        print("PASS: Farmer schema has latitude and longitude.")
    else:
        print("FAIL: Farmer schema missing latitude or longitude.")

    # Check Router Endpoint
    found_endpoint = False
    for route in router.routes:
        if route.path == "/aggregation/monthly":
            found_endpoint = True
            break
            
    if found_endpoint:
        print("PASS: Orders router has /aggregation/monthly endpoint.")
    else:
        print("FAIL: Orders router missing /aggregation/monthly endpoint.")

except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
