from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AccessLog


async def log_access(
    db: AsyncSession,
    actor_type: str,
    actor_id: Optional[int],
    actor_name: Optional[str],
    line_user_id: Optional[str],
    action: Optional[str] = None,
    path: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log = AccessLog(
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        line_user_id=line_user_id,
        action=action,
        path=path,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    await db.commit()
