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
        logger.error("Attempted upload but CLOUDINARY_CLOUD_NAME is not configured.")
        return None
    
    if not settings.CLOUDINARY_API_KEY or not settings.CLOUDINARY_API_SECRET:
        logger.error("Attempted upload but CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is missing.")
        return None

    try:
        response = cloudinary.uploader.upload(
            file_obj,
            folder=folder,
            resource_type="image"
        )
        return response
    except Exception as e:
        # Log specific error details from Cloudinary
        error_msg = str(e)
        # Some Cloudinary errors are in the message or args
        logger.error(f"Cloudinary upload error: {error_msg}")
        return None

def upload_file(file_obj, folder: str = "refarm/docs", resource_type: str = "auto", public_id: str = None):
    """
    Uploads a file (PDF, etc.) to Cloudinary.
    """
    if not settings.CLOUDINARY_CLOUD_NAME:
        logger.error("Cloudinary is not configured.")
        return None

    try:
        options = {
            "folder": folder,
            "resource_type": resource_type
        }
        if public_id:
            options["public_id"] = public_id
            options["overwrite"] = True
        
        # Explicitly set format to pdf for PDF files if detected
        # Check if it's a file-like object with name
        if hasattr(file_obj, 'name') and file_obj.name.endswith('.pdf'):
             options["format"] = "pdf"
        
        # Cloudinary specific fix for "Document could not be loaded" on mobile/browsers for raw uploads
        # Force resource_type to "auto" (which becomes "image" for PDFs) so Cloudinary processes it as a viewable document
        # BUT `write_pdf()` returns bytes, so `file_obj` is bytes/BytesIO.
        # If we use resource_type='raw', it's just a file. If 'auto' or 'image', it can be viewed.
        # PDFs are often better served as 'image' resource_type in Cloudinary for viewing, or 'raw' for just download.
        # But 'raw' URLs sometimes lack correct Content-Type headers if not set.
        # Let's try forcing resource_type="auto" if it was "raw" but we suspect it's a PDF.
        
        if resource_type == "auto" and public_id and public_id.endswith(".pdf"):
             # If we are uploading with a public_id that ends in .pdf and resource_type auto, it usually works.
             # But if it ends up as raw, browsers might fail to render.
             # Consider forcing resource_type="image" and format="pdf" for robust PDF handling on Cloudinary?
             # Actually, if we just upload it, Cloudinary returns a URL.
             # The URL structure /raw/upload/ vs /image/upload/ matters.
             pass

        response = cloudinary.uploader.upload(file_obj, **options)
        return response
    except Exception as e:
        logger.error(f"Cloudinary file upload error: {e}")
        return None
