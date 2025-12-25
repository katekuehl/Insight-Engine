def test_analytics_service_import():
    try:
        from analytics_service import main
        assert main.app is not None
    except ImportError as e:
        pytest.fail(f"Failed to import analytics_service.main: {e}")
