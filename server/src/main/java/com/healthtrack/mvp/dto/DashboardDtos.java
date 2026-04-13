package com.healthtrack.mvp.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record DailySummaryPoint(
            LocalDate date,
            Integer calories,
            Integer exerciseMinutes,
            Integer careMinutes
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
            Double sleepHours,
            Double glucoseMmol
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

