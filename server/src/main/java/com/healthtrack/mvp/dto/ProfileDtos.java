package com.healthtrack.mvp.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class ProfileDtos {

    private ProfileDtos() {
    }

    public record ProfileRequest(
            String nickname,
            String avatarPresetId,
            String avatarUri,
            String conditionLabel,
            String fastingGlucoseBaseline,
            String bloodPressureBaseline,
            Integer restingHeartRate,
            String medicationPlan,
            String notes,
            Integer age,
            String gender,
            BigDecimal heightCm,
            BigDecimal weightKg,
            BigDecimal targetWeightKg,
            Integer dailyCalorieGoal,
            Integer weeklyExerciseGoalMinutes,
            String careFocus,
            String healthGoal
    ) {
    }

    public record ProfileResponse(
            String email,
            String nickname,
            String avatarPresetId,
            String avatarUri,
            String conditionLabel,
            String fastingGlucoseBaseline,
            String bloodPressureBaseline,
            Integer restingHeartRate,
            String medicationPlan,
            String notes,
            Integer age,
            String gender,
            BigDecimal heightCm,
            BigDecimal weightKg,
            BigDecimal targetWeightKg,
            Integer dailyCalorieGoal,
            Integer weeklyExerciseGoalMinutes,
            String careFocus,
            String healthGoal,
            LocalDateTime updatedAt
    ) {
    }
}

