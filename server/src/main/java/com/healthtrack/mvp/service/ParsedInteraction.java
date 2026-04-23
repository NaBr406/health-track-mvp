package com.healthtrack.mvp.service;

import com.healthtrack.mvp.integration.dify.DifyRecordExtractorClient;
import java.util.List;
import org.springframework.util.StringUtils;

record ParsedInteraction(
        Integer calories,
        Integer exerciseMinutes,
        Integer steps,
        Double glucoseMmol,
        Double sleepHours,
        String mealType,
        String foodName,
        String activityName,
        String glucoseRiskLevel,
        Boolean calibrationApplied,
        Double peakGlucoseMmol,
        Double peakHourOffset,
        Double returnToBaselineHourOffset,
        List<DifyRecordExtractorClient.GlucoseForecastPoint> glucoseForecast8h,
        Boolean needsFollowup,
        String followupQuestion,
        Double confidence
) {

    static ParsedInteraction fromExtractorResult(DifyRecordExtractorClient.RecordExtractionResult extracted) {
        return new ParsedInteraction(
                extracted.calories(),
                extracted.exerciseMinutes(),
                extracted.steps(),
                extracted.glucoseMmol(),
                extracted.sleepHours(),
                extracted.mealType(),
                extracted.foodName(),
                extracted.activityName(),
                extracted.glucoseRiskLevel(),
                extracted.calibrationApplied(),
                extracted.peakGlucoseMmol(),
                extracted.peakHourOffset(),
                extracted.returnToBaselineHourOffset(),
                extracted.glucoseForecast8h(),
                extracted.needsFollowup(),
                extracted.followupQuestion(),
                extracted.confidence()
        );
    }

    boolean hasForecastData() {
        return StringUtils.hasText(glucoseRiskLevel)
                || calibrationApplied != null
                || peakGlucoseMmol != null
                || peakHourOffset != null
                || returnToBaselineHourOffset != null
                || (glucoseForecast8h != null && !glucoseForecast8h.isEmpty());
    }

    Double forecastAnchorGlucoseMmol() {
        if (glucoseForecast8h == null || glucoseForecast8h.isEmpty()) {
            return null;
        }

        return glucoseForecast8h.stream()
                .filter(point -> point.hourOffset() != null && point.hourOffset() == 0)
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::predictedGlucoseMmol)
                .findFirst()
                .orElse(glucoseForecast8h.get(0).predictedGlucoseMmol());
    }
}
