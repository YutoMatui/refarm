import cloudinary
import cloudinary.uploader
from app.core.config import settings

# Initialize Cloudinary
cloudinary.config( 
  cloud_name = settings.CLOUDINARY_CLOUD_NAME, 
  api_key = settings.CLOUDINARY_API_KEY, 
  api_secret = settings.CLOUDINARY_API_SECRET,
  secure = True
)

def upload_image(file_obj, folder: str = "refarm"):
    """
    Uploads an image file to Cloudinary.
    
    Args:
        file_obj: File-like object to upload
        folder: Folder name in Cloudinary
        
    Returns:
        dict: Upload result from Cloudinary
    """
    try:
        response = cloudinary.uploader.upload(
            file_obj,
            folder=folder,
            resource_type="image"
        )
        return response
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        return None
