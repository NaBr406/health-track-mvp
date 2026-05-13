package com.healthtrack.mvp.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 健康档案读写接口使用的 DTO 定义集合。
 */
public final class ProfileDtos {

    private ProfileDtos() {
    }

    public record ProfileRequest(
            @Size(max = 80) String nickname,
            @Size(max = 40) String avatarPresetId,
            @Size(max = 2048) String avatarUri,
            @Size(max = 120) String conditionLabel,
            @Size(max = 120) String fastingGlucoseBaseline,
            @Size(max = 60) String bloodPressureBaseline,
            @Min(30) @Max(220) Integer restingHeartRate,
            @Size(max = 255) String medicationPlan,
            @Size(max = 1000) String notes,
            @Min(1) @Max(150) Integer age,
            @Size(max = 20) String gender,
            BigDecimal heightCm,
            BigDecimal weightKg,
            BigDecimal targetWeightKg,
            @Min(500) @Max(10000) Integer dailyCalorieGoal,
            @Min(0) @Max(2000) Integer weeklyExerciseGoalMinutes,
            @Size(max = 120) String careFocus,
            @Size(max = 255) String healthGoal
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

