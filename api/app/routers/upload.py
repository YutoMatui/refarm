from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.core.cloudinary import upload_image

router = APIRouter()

@router.post("/image", response_model=dict)
async def upload_image_endpoint(file: UploadFile = File(...)):
    """
    Upload an image to Cloudinary and return the URL.
    This URL can then be used in Product or Farmer creation.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Read file content
    content = await file.read()
    
    # Upload to Cloudinary
    result = upload_image(content)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload failed"
        )
    
    return {
        "url": result.get("secure_url"),
        "public_id": result.get("public_id")
    }
