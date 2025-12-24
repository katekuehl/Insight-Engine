import os

from dotenv import load_dotenv

load_dotenv()


def get_database_url(*, required: bool = True) -> str | None:
    value = os.environ.get("DATABASE_URL")
    if required and not value:
        raise ValueError("DATABASE_URL environment variable not set")
    return value


def get_analytics_port(default: int = 8000) -> int:
    value = os.environ.get("ANALYTICS_PORT")
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default
