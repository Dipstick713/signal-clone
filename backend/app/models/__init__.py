"""SQLAlchemy models.

Importing this package imports every model module so that they register with
`Base.metadata` before `create_all` runs.
"""
from app.models.user import User

__all__ = ["User"]
