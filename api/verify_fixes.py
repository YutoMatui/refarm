
print("Verifying imports...")
try:
    from app.main import app
    print("SUCCESS: app.main imported")
except Exception as e:
    print(f"ERROR: app.main import failed: {e}")

try:
    from app.services.line_notify import line_service
    print("SUCCESS: app.services.line_notify imported")
except Exception as e:
    print(f"ERROR: app.services.line_notify import failed: {e}")

try:
    from app.routers import producer
    print("SUCCESS: app.routers.producer imported")
except Exception as e:
    print(f"ERROR: app.routers.producer import failed: {e}")

try:
    from app.routers import orders
    print("SUCCESS: app.routers.orders imported")
except Exception as e:
    print(f"ERROR: app.routers.orders import failed: {e}")

print("Verification complete.")
