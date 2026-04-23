package com.healthtrack.mvp.service;

import com.healthtrack.mvp.integration.dify.DifyRecordExtractorClient;
import java.util.List;

record ForecastComputation(
        String glucoseRiskLevel,
        Boolean calibrationApplied,
        Double peakGlucoseMmol,
        Double peakHourOffset,
        Double returnToBaselineHourOffset,
        List<DifyRecordExtractorClient.GlucoseForecastPoint> glucoseForecast8h,
        Double forecastAnchorGlucoseMmol
) {
}
