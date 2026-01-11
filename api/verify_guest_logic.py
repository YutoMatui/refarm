
import sys
import os
import asyncio

# Add webapp/api to python path
sys.path.append(os.path.join(os.getcwd(), 'webapp', 'api'))

from app.models.guest import GuestInteraction
from app.routers.guest import InteractionCreate

print("Imports successful")

try:
    data = InteractionCreate(
        visit_id=1,
        farmer_id=1,
        interaction_type="STAMP",
        stamp_type="delicious"
    )
    print("Model validation successful:", data)
    
    interaction = GuestInteraction(
        visit_id=data.visit_id,
        farmer_id=data.farmer_id,
        interaction_type=data.interaction_type,
        stamp_type=data.stamp_type
    )
    print("ORM Object created:", interaction)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
