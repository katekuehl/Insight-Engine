import pytest
from unittest.mock import patch
from loaders.data_loader import get_connection

def test_get_connection_missing_env():
    with patch.dict('os.environ', clear=True):
        # Depending on how config.py is implemented, it might need reloading 
        # or just patching os.environ might be enough if get_database_url reads fresh each time.
        # Assuming get_database_url reads os.environ directly:
        with pytest.raises(ValueError, match="DATABASE_URL environment variable not set"):
            get_connection()

def test_get_connection_success():
    fake_url = "postgresql://user:pass@localhost:5432/testdb"
    with patch.dict('os.environ', {'DATABASE_URL': fake_url}):
        with patch('psycopg2.connect') as mock_connect:
            get_connection()
            mock_connect.assert_called_once_with(fake_url)
