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

app = FastAPI(
    title="Strata Analytics Service",
    description="Statistical analysis operators for the Relationship Engine",
    version="1.0.0"
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

# Initialize operators
prepare_data_op = PrepareDataOperator()
descriptive_stats_op = DescriptiveStatsOperator()
correlation_matrix_op = CorrelationMatrixOperator()
trend_detection_op = TrendDetectionOperator()
time_series_op = TimeSeriesOperator()
regression_summary_op = RegressionSummaryOperator()
decomposition_op = DecompositionOperator()
aggregation_op = AggregationOperator()

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ANALYTICS_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
