package com.healthtrack.mvp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 饮食、运动、护理记录接口使用的 DTO 定义集合。
 */
public final class RecordDtos {

    private RecordDtos() {
    }

    public record DietRecordRequest(
            LocalDate recordedOn,
            @NotBlank String mealType,
            @NotBlank String foodName,
            @NotNull @Min(0) Integer calories,
            BigDecimal proteinGrams,
            BigDecimal carbsGrams,
            BigDecimal fatGrams,
            String note
    ) {
    }

    public record DietRecordResponse(
            Long id,
            LocalDate recordedOn,
            String mealType,
            String foodName,
            Integer calories,
            BigDecimal proteinGrams,
            BigDecimal carbsGrams,
            BigDecimal fatGrams,
            String note,
            LocalDateTime createdAt
    ) {
    }

    public record ExerciseRecordRequest(
            LocalDate recordedOn,
            @NotBlank String activityName,
            @NotNull @Min(1) Integer durationMinutes,
            @Min(0) Integer caloriesBurned,
            String intensity,
            String note
    ) {
    }

    public record ExerciseRecordResponse(
            Long id,
            LocalDate recordedOn,
            String activityName,
            Integer durationMinutes,
            Integer caloriesBurned,
            String intensity,
            String note,
            LocalDateTime createdAt
    ) {
    }

    public record StepRecordSyncItemRequest(
            @NotNull LocalDate recordedOn,
            @NotNull @Min(0) Integer steps,
            String source,
            String sourceDevice,
            String sourceTimeZone,
            LocalDateTime syncedAt
    ) {
    }

    public record StepRecordSyncRequest(
            @NotEmpty List<@Valid StepRecordSyncItemRequest> records
    ) {
    }

    public record StepRecordResponse(
            Long id,
            LocalDate recordedOn,
            Integer steps,
            String source,
            String sourceDevice,
            String sourceTimeZone,
            LocalDateTime syncedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record CareRecordRequest(
            LocalDate recordedOn,
            @NotBlank String category,
            @NotBlank String itemName,
            @Min(0) Integer durationMinutes,
            String status,
            String note,
            Double glucoseMmol
    ) {
    }

    public record CareRecordResponse(
            Long id,
            LocalDate recordedOn,
            String category,
            String itemName,
            Integer durationMinutes,
            String status,
            String note,
            Double glucoseMmol,
            LocalDateTime createdAt
    ) {
    }
}

