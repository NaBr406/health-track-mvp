package com.healthtrack.mvp.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 仪表盘摘要、快照和反馈接口使用的 DTO 定义集合。
 */
public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record DailySummaryPoint(
            LocalDate date,
            Integer calories,
            Integer exerciseMinutes,
            Integer steps,
            String stepsSource,
            Integer careMinutes,
            Double glucoseMmol
    ) {
    }

    public record DashboardSummaryResponse(
            LocalDate focusDate,
            Integer dietCount,
            Integer exerciseCount,
            Integer careCount,
            Integer totalCalories,
            Integer totalExerciseMinutes,
            Integer totalCareMinutes,
            Integer dailyCalorieGoal,
            Integer weeklyExerciseGoalMinutes,
            Integer goalCompletionRate,
            List<DailySummaryPoint> weeklyActivity,
            String latestAdvice
    ) {
    }

    public record PlanAdjustmentResponse(
            String id,
            String title,
            String summary,
            String parameterLabel,
            String parameterDelta,
            String rationale,
            LocalDateTime generatedAt,
            String feedback
    ) {
    }

    public record DashboardMetricResponse(
            String id,
            String label,
            String value,
            String unit,
            String descriptor,
            String source
    ) {
    }

    public record MonitoringHistoryPointResponse(
            LocalDate date,
            Integer calories,
            Integer exerciseMinutes,
            Integer steps,
            String stepsSource,
            Double sleepHours,
            Double glucoseMmol,
            String glucoseSource
    ) {
    }

    public record GlucoseForecastPointResponse(
            Integer hourOffset,
            Double predictedGlucoseMmol,
            String pointType
    ) {
    }

    public record DashboardSnapshotResponse(
            LocalDate focusDate,
            String headline,
            PlanAdjustmentResponse adjustment,
            List<DashboardMetricResponse> metrics,
            String observation,
            LocalDateTime refreshedAt,
            List<MonitoringHistoryPointResponse> history,
            String glucoseRiskLevel,
            Boolean calibrationApplied,
            Double peakGlucoseMmol,
            Double peakHourOffset,
            Double returnToBaselineHourOffset,
            List<GlucoseForecastPointResponse> glucoseForecast8h,
            String forecastSource,
            String dataSource
    ) {
    }

    public record AdjustmentFeedbackRequest(
            String adjustmentId,
            String feedback,
            LocalDate focusDate
    ) {
    }
}

