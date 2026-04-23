package com.healthtrack.mvp.service;

import com.healthtrack.mvp.integration.dify.DifyRecordExtractorClient;
import java.util.List;

final class InteractionDayState {

    private Integer steps;
    private Double glucoseMmol;
    private Double forecastAnchorGlucoseMmol;
    private Double sleepHours;
    private String glucoseRiskLevel;
    private Boolean calibrationApplied;
    private Double peakGlucoseMmol;
    private Double peakHourOffset;
    private Double returnToBaselineHourOffset;
    private List<DifyRecordExtractorClient.GlucoseForecastPoint> glucoseForecast8h = List.of();
    private String forecastSource;

    Integer steps() {
        return steps;
    }

    void setSteps(Integer steps) {
        this.steps = steps;
    }

    Double glucoseMmol() {
        return glucoseMmol;
    }

    void setGlucoseMmol(Double glucoseMmol) {
        this.glucoseMmol = glucoseMmol;
    }

    Double forecastAnchorGlucoseMmol() {
        return forecastAnchorGlucoseMmol;
    }

    void setForecastAnchorGlucoseMmol(Double forecastAnchorGlucoseMmol) {
        this.forecastAnchorGlucoseMmol = forecastAnchorGlucoseMmol;
    }

    Double sleepHours() {
        return sleepHours;
    }

    void setSleepHours(Double sleepHours) {
        this.sleepHours = sleepHours;
    }

    String glucoseRiskLevel() {
        return glucoseRiskLevel;
    }

    void setGlucoseRiskLevel(String glucoseRiskLevel) {
        this.glucoseRiskLevel = glucoseRiskLevel;
    }

    Boolean calibrationApplied() {
        return calibrationApplied;
    }

    void setCalibrationApplied(Boolean calibrationApplied) {
        this.calibrationApplied = calibrationApplied;
    }

    Double peakGlucoseMmol() {
        return peakGlucoseMmol;
    }

    void setPeakGlucoseMmol(Double peakGlucoseMmol) {
        this.peakGlucoseMmol = peakGlucoseMmol;
    }

    Double peakHourOffset() {
        return peakHourOffset;
    }

    void setPeakHourOffset(Double peakHourOffset) {
        this.peakHourOffset = peakHourOffset;
    }

    Double returnToBaselineHourOffset() {
        return returnToBaselineHourOffset;
    }

    void setReturnToBaselineHourOffset(Double returnToBaselineHourOffset) {
        this.returnToBaselineHourOffset = returnToBaselineHourOffset;
    }

    List<DifyRecordExtractorClient.GlucoseForecastPoint> glucoseForecast8h() {
        return glucoseForecast8h;
    }

    void setGlucoseForecast8h(List<DifyRecordExtractorClient.GlucoseForecastPoint> glucoseForecast8h) {
        this.glucoseForecast8h = glucoseForecast8h == null ? List.of() : List.copyOf(glucoseForecast8h);
    }

    String forecastSource() {
        return forecastSource;
    }

    void setForecastSource(String forecastSource) {
        this.forecastSource = forecastSource;
    }
}
