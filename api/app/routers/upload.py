from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.core.cloudinary import upload_image
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/image", response_model=dict)
def upload_image_endpoint(file: UploadFile = File(...)):
    """
    Upload an image to Cloudinary and return the URL.
    This URL can then be used in Product or Farmer creation.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    logger.info(f"Uploading image: {file.filename} ({file.content_type})")
    
    # Pass the underlying file object directly to cloudinary (more memory efficient)
    # We use def instead of async def so FastAPI runs this in a threadpool,
    # avoiding blocking the event loop during the network call.
    result = upload_image(file.file)
    
    if not result:
        logger.error(f"Image upload failed for {file.filename}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload failed. Please contact support or check if Cloudinary is configured."
        )
    
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id")
    }
