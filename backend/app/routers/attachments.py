"""Image attachment upload and serving.

Upload is authenticated; the raw bytes are served publicly by id so an
`<img src>` (which can't send an Authorization header) can load them. Ids are
opaque enough for a demo — a production build would use signed URLs and store
bytes in object storage rather than the database.
"""
from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status

from app.deps import CurrentUser, DbSession
from app.models.attachment import Attachment
from app.schemas.conversation import AttachmentPublic

router = APIRouter(prefix="/api/attachments", tags=["attachments"])

MAX_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("", response_model=AttachmentPublic)
async def upload_attachment(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
):
    """Upload an image; returns metadata to attach to a message when sent."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only images are supported"
        )
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds the 5 MB limit",
        )

    attachment = Attachment(
        uploader_id=current_user.id,
        mime=file.content_type,
        filename=file.filename or "image",
        size=len(data),
        content=data,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/{attachment_id}/content")
def get_attachment_content(attachment_id: int, db: DbSession):
    """Serve raw image bytes (public — consumed directly by <img>)."""
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found"
        )
    return Response(
        content=attachment.content,
        media_type=attachment.mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
