"""
Settings API Router - システム設定
"""
import json
import os
from typing import List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()

SETTINGS_FILE = "app/data/settings.json"

# Ensure data directory exists
os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)

class TimeSlot(BaseModel):
    id: str
    label: str
    enabled: bool

class DeliverySettings(BaseModel):
    allowed_days: List[int] = Field(default=[0, 1, 2, 3, 4, 5, 6], description="配送可能曜日 (0=Sunday, 1=Monday, ...)")
    closed_dates: List[str] = Field(default_factory=list, description="休業日 (YYYY-MM-DD)")
    time_slots: List[TimeSlot] = Field(
        default=[
            {"id": "12-14", "label": "12:00 〜 14:00", "enabled": True},
            {"id": "14-16", "label": "14:00 〜 16:00", "enabled": True},
            {"id": "16-18", "label": "16:00 〜 18:00", "enabled": True},
        ],
        description="配送時間枠"
    )

class GeneralSettings(BaseModel):
    default_price_multiplier: float = Field(default=0.7, ge=0.1, le=1.0, description="価格係数 (卸値 / 係数 = 販売価格)")

GENERAL_SETTINGS_FILE = "app/data/general_settings.json"

def load_settings() -> DeliverySettings:
    if not os.path.exists(SETTINGS_FILE):
        return DeliverySettings()
    try:
        with open(SETTINGS_FILE, "r") as f:
            data = json.load(f)
            return DeliverySettings(**data)
    except Exception:
        return DeliverySettings()

def save_settings(settings: DeliverySettings):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings.model_dump(), f)

def load_general_settings() -> GeneralSettings:
    if not os.path.exists(GENERAL_SETTINGS_FILE):
        return GeneralSettings()
    try:
        with open(GENERAL_SETTINGS_FILE, "r") as f:
            data = json.load(f)
            return GeneralSettings(**data)
    except Exception:
        return GeneralSettings()

def save_general_settings(settings: GeneralSettings):
    with open(GENERAL_SETTINGS_FILE, "w") as f:
        json.dump(settings.model_dump(), f)

@router.get("/delivery", response_model=DeliverySettings)
async def get_delivery_settings():
    """配送設定を取得"""
    return load_settings()

@router.post("/delivery", response_model=DeliverySettings)
async def update_delivery_settings(settings: DeliverySettings):
    """配送設定を更新"""
    save_settings(settings)
    return settings

@router.get("/general", response_model=GeneralSettings)
async def get_general_settings():
    """一般設定（価格係数など）を取得"""
    return load_general_settings()

@router.post("/general", response_model=GeneralSettings)
async def update_general_settings(settings: GeneralSettings):
    """一般設定を更新"""
    save_general_settings(settings)
    return settings
