import logging
import cloudinary
import cloudinary.uploader
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Cloudinary
if settings.CLOUDINARY_CLOUD_NAME:
    cloudinary.config( 
      cloud_name = settings.CLOUDINARY_CLOUD_NAME, 
      api_key = settings.CLOUDINARY_API_KEY, 
      api_secret = settings.CLOUDINARY_API_SECRET,
      secure = True
    )
else:
    logger.warning("Cloudinary is not configured. Uploads will fail.")

def upload_image(file_obj, folder: str = "refarm"):
    """
    Uploads an image file to Cloudinary.
    
    Args:
        file_obj: File-like object or bytes to upload
        folder: Folder name in Cloudinary
        
    Returns:
        dict: Upload result from Cloudinary
    """
    if not settings.CLOUDINARY_CLOUD_NAME:
        logger.error("Attempted upload but Cloudinary is not configured.")
        return None

    try:
        response = cloudinary.uploader.upload(
            file_obj,
            folder=folder,
            resource_type="image"
        )
        return response
    except Exception as e:
        logger.error(f"Cloudinary upload error: {str(e)}", exc_info=True)
        return None
