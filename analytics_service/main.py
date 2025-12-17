"""
Analytics Service - FastAPI microservice for statistical analysis operators
This service is called by the Node.js DAG executor to run analytical computations.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional, List
import os

from operators.descriptive_stats import DescriptiveStatsOperator
from operators.correlation_matrix import CorrelationMatrixOperator
from operators.trend_detection import TrendDetectionOperator
from operators.time_series import TimeSeriesOperator
from operators.regression_summary import RegressionSummaryOperator
from operators.decomposition import DecompositionOperator
from operators.aggregation import AggregationOperator
from operators.prepare_data import PrepareDataOperator
from operators.group_comparison import GroupComparisonOperator
from operators.model_diagnostics import ModelDiagnosticsOperator
from operators.attribution_modeling import AttributionModelingOperator
from operators.residual_diagnostics import ResidualDiagnosticsOperator
from operators.phase2_aggregation import Phase2AggregationOperator
from operators.arima_forecast import ARIMAForecastOperator
from operators.prophet_forecast import ProphetForecastOperator
from operators.lstm_forecast import LSTMForecastOperator
from operators.exponential_smoothing import ExponentialSmoothingOperator
from operators.ensemble_aggregation import EnsembleAggregationOperator
from operators.forecast_outputs import ForecastOutputsOperator

app = FastAPI(
    title="Strata Analytics Service",
    description="Statistical analysis operators for Phase 1 (Relationship Engine), Phase 2 (Impact Engine), and Phase 3 (Forecast Engine)",
    version="3.0.0"
)

class OperatorRequest(BaseModel):
    task_instance_id: str
    dag_run_id: str
    organization_id: str
    config: Dict[str, Any]
    upstream_data: Dict[str, Any]

class OperatorResponse(BaseModel):
    success: bool
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    logs: Optional[str] = None

# Initialize Phase 1 operators
prepare_data_op = PrepareDataOperator()
descriptive_stats_op = DescriptiveStatsOperator()
correlation_matrix_op = CorrelationMatrixOperator()
trend_detection_op = TrendDetectionOperator()
time_series_op = TimeSeriesOperator()
regression_summary_op = RegressionSummaryOperator()
decomposition_op = DecompositionOperator()
aggregation_op = AggregationOperator()

# Initialize Phase 2 operators
group_comparison_op = GroupComparisonOperator()
model_diagnostics_op = ModelDiagnosticsOperator()
attribution_modeling_op = AttributionModelingOperator()
residual_diagnostics_op = ResidualDiagnosticsOperator()
phase2_aggregation_op = Phase2AggregationOperator()

# Initialize Phase 3 operators
arima_forecast_op = ARIMAForecastOperator()
prophet_forecast_op = ProphetForecastOperator()
lstm_forecast_op = LSTMForecastOperator()
exponential_smoothing_op = ExponentialSmoothingOperator()
ensemble_aggregation_op = EnsembleAggregationOperator()
forecast_outputs_op = ForecastOutputsOperator()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics"}

@app.post("/operators/prepare_data", response_model=OperatorResponse)
async def run_prepare_data(request: OperatorRequest):
    try:
        result = await prepare_data_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))

@app.post("/operators/descriptive_stats", response_model=OperatorResponse)
async def run_descriptive_stats(request: OperatorRequest):
    try:
        result = await descriptive_stats_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))

@app.post("/operators/correlation_matrix", response_model=OperatorResponse)
async def run_correlation_matrix(request: OperatorRequest):
    try:
        result = await correlation_matrix_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))

@app.post("/operators/trend_detection", response_model=OperatorResponse)
async def run_trend_detection(request: OperatorRequest):
    try:
        result = await trend_detection_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))

@app.post("/operators/time_series", response_model=OperatorResponse)
async def run_time_series(request: OperatorRequest):
    try:
        result = await time_series_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))

@app.post("/operators/regression_summary", response_model=OperatorResponse)
async def run_regression_summary(request: OperatorRequest):
    try:
        result = await regression_summary_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))

@app.post("/operators/decomposition", response_model=OperatorResponse)
async def run_decomposition(request: OperatorRequest):
    try:
        result = await decomposition_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))

@app.post("/operators/aggregation", response_model=OperatorResponse)
async def run_aggregation(request: OperatorRequest):
    try:
        result = await aggregation_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


# ============================================================
# Phase 2: Impact Engine Operators
# ============================================================

@app.post("/operators/group_comparison", response_model=OperatorResponse)
async def run_group_comparison(request: OperatorRequest):
    """
    Group Comparison Module: t-tests, ANOVA, Kruskal-Wallis, effect sizes
    Compares metrics across customer segments to find significant differences.
    """
    try:
        result = await group_comparison_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/model_diagnostics", response_model=OperatorResponse)
async def run_model_diagnostics(request: OperatorRequest):
    """
    Model Diagnostics Module: residual analysis, Q-Q plots, Durbin-Watson,
    Shapiro-Wilk, cross-validation for overfitting detection.
    """
    try:
        result = await model_diagnostics_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/attribution_modeling", response_model=OperatorResponse)
async def run_attribution_modeling(request: OperatorRequest):
    """
    Attribution Modeling Module: first/last/linear/time-decay/position-based
    touch attribution plus Shapley values for fair channel credit allocation.
    """
    try:
        result = await attribution_modeling_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/residual_diagnostics", response_model=OperatorResponse)
async def run_residual_diagnostics(request: OperatorRequest):
    """
    Residual Diagnostics Module: K-means/DBSCAN clustering of residuals,
    pattern analysis, systematic bias detection, improvement recommendations.
    """
    try:
        result = await residual_diagnostics_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/phase2_aggregation", response_model=OperatorResponse)
async def run_phase2_aggregation(request: OperatorRequest):
    """
    Phase 2 Aggregation: Combines all Impact Engine module outputs into
    a unified diagnostic report with business insights and recommendations.
    """
    try:
        result = await phase2_aggregation_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


# ============================================================
# Phase 3: Forecast Engine Operators
# ============================================================

@app.post("/operators/arima_forecast", response_model=OperatorResponse)
async def run_arima_forecast(request: OperatorRequest):
    """
    ARIMA Forecasting: AutoRegressive Integrated Moving Average for
    capturing temporal patterns and autoregressive dependencies.
    Best for short-term forecasts (1-6 months).
    """
    try:
        result = await arima_forecast_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/prophet_forecast", response_model=OperatorResponse)
async def run_prophet_forecast(request: OperatorRequest):
    """
    Prophet Forecasting: Facebook's algorithm for trend, seasonality
    (daily/weekly/yearly), and holiday effects. Robust to missing data.
    """
    try:
        result = await prophet_forecast_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/lstm_forecast", response_model=OperatorResponse)
async def run_lstm_forecast(request: OperatorRequest):
    """
    LSTM Forecasting: Recurrent neural networks that capture complex
    nonlinear temporal dependencies. Best for high-dimensional patterns.
    """
    try:
        result = await lstm_forecast_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/exponential_smoothing", response_model=OperatorResponse)
async def run_exponential_smoothing(request: OperatorRequest):
    """
    Exponential Smoothing: Holt-Winters approach for simple, interpretable
    forecasting. Adapts quickly to recent changes, robust baseline.
    """
    try:
        result = await exponential_smoothing_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/ensemble_aggregation", response_model=OperatorResponse)
async def run_ensemble_aggregation(request: OperatorRequest):
    """
    Ensemble Aggregation: Weighted average of all 4 forecasting models.
    Weights determined by cross-validated error metrics (MAPE, RMSE).
    """
    try:
        result = await ensemble_aggregation_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/forecast_outputs", response_model=OperatorResponse)
async def run_forecast_outputs(request: OperatorRequest):
    """
    Forecast Outputs: Packages forecasts with 95%/99% confidence intervals,
    trend decompositions, anomaly alerts for business consumption.
    """
    try:
        result = await forecast_outputs_op.execute(
            organization_id=request.organization_id,
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ANALYTICS_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
