import pytest
from datetime import date
from connectors.csv_importer import month_to_date, parse_int, parse_float

def test_month_to_date_valid():
    assert month_to_date("January", 2025) == date(2025, 1, 1)

def test_month_to_date_invalid():
    with pytest.raises(ValueError, match="Invalid month name"):
        month_to_date("InvalidMonth", 2025)

def test_parse_int_clean():
    assert parse_int("1,234", "test_field") == 1234
    assert parse_int(" 500 ", "test_field") == 500

def test_parse_int_invalid():
    with pytest.raises(ValueError, match="Cannot parse"):
        parse_int("abc", "test_field")

def test_parse_float_currency():
    assert parse_float("$1,234.56", "test_field") == 1234.56

def test_parse_float_invalid():
    with pytest.raises(ValueError, match="Cannot parse"):
        parse_float("not_a_number", "test_field")
