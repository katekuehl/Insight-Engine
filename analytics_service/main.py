"""
Analytics Service - FastAPI microservice for statistical analysis operators
This service is called by the Node.js DAG executor to run analytical computations.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional, List
import os

try:
    from .operators.descriptive_stats import DescriptiveStatsOperator
    from .operators.correlation_matrix import CorrelationMatrixOperator
    from .operators.trend_detection import TrendDetectionOperator
    from .operators.time_series import TimeSeriesOperator
    from .operators.regression_summary import RegressionSummaryOperator
    from .operators.decomposition import DecompositionOperator
    from .operators.aggregation import AggregationOperator
    from .operators.prepare_data import PrepareDataOperator
    from .operators.group_comparison import GroupComparisonOperator
    from .operators.model_diagnostics import ModelDiagnosticsOperator
    from .operators.attribution_modeling import AttributionModelingOperator
    from .operators.residual_diagnostics import ResidualDiagnosticsOperator
    from .operators.phase2_aggregation import Phase2AggregationOperator
    from .operators.arima_forecast import ARIMAForecastOperator
    from .operators.prophet_forecast import ProphetForecastOperator
    from .operators.lstm_forecast import LSTMForecastOperator
    from .operators.exponential_smoothing import ExponentialSmoothingOperator
    from .operators.ensemble_aggregation import EnsembleAggregationOperator
    from .operators.forecast_outputs import ForecastOutputsOperator
    from .operators.shap_feature_importance import shap_feature_importance_op
    from .operators.permutation_importance import permutation_importance_op
    from .operators.causal_effect_estimation import causal_effect_estimation_op
    from .operators.logistic_classifier import logistic_classifier_op
    from .operators.random_forest_classifier import random_forest_classifier_op
    from .operators.xgboost_classifier import xgboost_classifier_op
    from .operators.svm_classifier import svm_classifier_op
    from .operators.classification_ensemble import classification_ensemble_op
    from .operators.propensity_scores import propensity_scores_op
    from .operators.ranked_feature_importances import ranked_feature_importances_op
    from .operators.analysis_data_layer import analysis_data_layer_op
    from .operators.insight_deck import insight_deck_op
    from .operators.business_results_layer import business_results_layer_op
    from .operators.production_serving_layer import production_serving_layer_op
except ImportError:
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
    from operators.shap_feature_importance import shap_feature_importance_op
    from operators.permutation_importance import permutation_importance_op
    from operators.causal_effect_estimation import causal_effect_estimation_op
    from operators.logistic_classifier import logistic_classifier_op
    from operators.random_forest_classifier import random_forest_classifier_op
    from operators.xgboost_classifier import xgboost_classifier_op
    from operators.svm_classifier import svm_classifier_op
    from operators.classification_ensemble import classification_ensemble_op
    from operators.propensity_scores import propensity_scores_op
    from operators.ranked_feature_importances import ranked_feature_importances_op
    from operators.analysis_data_layer import analysis_data_layer_op
    from operators.insight_deck import insight_deck_op
    from operators.business_results_layer import business_results_layer_op
    from operators.production_serving_layer import production_serving_layer_op

app = FastAPI(
    title="Strata Analytics Service",
    description="Statistical analysis operators for Phases 1-5: Relationship Engine, Impact Engine, Forecast Engine, Propensity Engine, and Production Serving",
    version="5.0.0"
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


# ============================================================
# Phase 4: Propensity Engine Operators
# ============================================================

@app.post("/operators/shap_feature_importance", response_model=OperatorResponse)
async def run_shap_feature_importance(request: OperatorRequest):
    """
    SHAP Feature Importance: Game-theory based feature attribution
    using Shapley values for fair importance allocation.
    """
    try:
        result = await shap_feature_importance_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/permutation_importance", response_model=OperatorResponse)
async def run_permutation_importance(request: OperatorRequest):
    """
    Permutation Importance: Model-agnostic feature ranking by
    measuring prediction degradation when features are shuffled.
    """
    try:
        result = await permutation_importance_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/causal_effect_estimation", response_model=OperatorResponse)
async def run_causal_effect_estimation(request: OperatorRequest):
    """
    Causal Effect Estimation: ATE/HTE computation using propensity
    score stratification and doubly robust estimation.
    """
    try:
        result = await causal_effect_estimation_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/logistic_classifier", response_model=OperatorResponse)
async def run_logistic_classifier(request: OperatorRequest):
    """
    Logistic Regression: Interpretable baseline classifier with
    coefficients and odds ratios for feature interpretation.
    """
    try:
        result = await logistic_classifier_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/random_forest_classifier", response_model=OperatorResponse)
async def run_random_forest_classifier(request: OperatorRequest):
    """
    Random Forest: Ensemble of decision trees capturing complex
    feature interactions with native feature importance.
    """
    try:
        result = await random_forest_classifier_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/xgboost_classifier", response_model=OperatorResponse)
async def run_xgboost_classifier(request: OperatorRequest):
    """
    XGBoost: Gradient boosting with regularization for
    best-in-class predictive performance.
    """
    try:
        result = await xgboost_classifier_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/svm_classifier", response_model=OperatorResponse)
async def run_svm_classifier(request: OperatorRequest):
    """
    SVM: Support Vector Machine robust to outliers with
    kernel flexibility for nonlinear boundaries.
    """
    try:
        result = await svm_classifier_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/classification_ensemble", response_model=OperatorResponse)
async def run_classification_ensemble(request: OperatorRequest):
    """
    Classification Ensemble: Weighted average of all 4 classifiers
    with probability calibration (isotonic/Platt scaling).
    """
    try:
        result = await classification_ensemble_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/propensity_scores", response_model=OperatorResponse)
async def run_propensity_scores(request: OperatorRequest):
    """
    Propensity Scores: Calibrated scores with segment-level
    effect sizes for business targeting recommendations.
    """
    try:
        result = await propensity_scores_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/ranked_feature_importances", response_model=OperatorResponse)
async def run_ranked_feature_importances(request: OperatorRequest):
    """
    Ranked Feature Importances: Unified ranking combining SHAP,
    permutation, and causal importance methods.
    """
    try:
        result = await ranked_feature_importances_op.execute(
            organization_id=int(request.organization_id),
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


# ============================================================================
# PRODUCTION SERVING (END PHASE) OPERATORS
# ============================================================================

@app.post("/operators/analysis_data_layer", response_model=OperatorResponse)
async def run_analysis_data_layer(request: OperatorRequest):
    """
    Analysis Data Layer: Aggregates, versions, and persists all analytical
    outputs from Phases 1-4 into a unified production data model.
    """
    try:
        result = await analysis_data_layer_op.execute(
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/insight_deck", response_model=OperatorResponse)
async def run_insight_deck(request: OperatorRequest):
    """
    Insight Deck: Generates automated executive reports with visualizations
    and actionable recommendations for business stakeholders.
    """
    try:
        result = await insight_deck_op.execute(
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/business_results_layer", response_model=OperatorResponse)
async def run_business_results_layer(request: OperatorRequest):
    """
    Business Results Layer: Delivers analytical findings to stakeholders
    through multiple channels (email, Slack, dashboard, CRM).
    """
    try:
        result = await business_results_layer_op.execute(
            config=request.config,
            upstream_data=request.upstream_data
        )
        return OperatorResponse(success=True, output=result)
    except Exception as e:
        return OperatorResponse(success=False, error=str(e))


@app.post("/operators/production_serving_layer", response_model=OperatorResponse)
async def run_production_serving_layer(request: OperatorRequest):
    """
    Production Serving Layer: Deploys analytical scores and predictions
    into live operational systems via API endpoints and database write-back.
    """
    try:
        result = await production_serving_layer_op.execute(
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
