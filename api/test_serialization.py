
from app.schemas.consumer_order import ConsumerOrderResponse
from app.models.enums import OrderStatus, DeliverySlotType
from datetime import datetime
from decimal import Decimal

def test_serialization():
    data = {
        "id": 1,
        "consumer_id": 1,
        "delivery_type": DeliverySlotType.HOME,
        "delivery_label": "自宅配送",
        "delivery_time_label": "14:00-16:00",
        "status": OrderStatus.PENDING,
        "subtotal": Decimal("1000.00"),
        "tax_amount": Decimal("80.00"),
        "shipping_fee": 300,
        "total_amount": Decimal("1380.00"),
        "order_items": [],
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    # Verify ConsumerOrderResponse
    obj = ConsumerOrderResponse.model_validate(data)
    json_data = obj.model_dump_json()
    print(f"Serialized JSON: {json_data}")

if __name__ == "__main__":
    test_serialization()
