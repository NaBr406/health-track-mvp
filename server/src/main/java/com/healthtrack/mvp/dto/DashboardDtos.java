package com.healthtrack.mvp.dto;

import java.time.LocalDate;
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
}

