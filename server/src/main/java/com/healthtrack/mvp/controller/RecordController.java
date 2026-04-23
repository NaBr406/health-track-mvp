package com.healthtrack.mvp.controller;

import com.healthtrack.mvp.dto.RecordDtos.CareRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.CareRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.DietRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.DietRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.ExerciseRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.ExerciseRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.StepRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.StepRecordSyncRequest;
import com.healthtrack.mvp.service.RecordService;
import com.healthtrack.mvp.util.SecurityUtils;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 饮食、运动和护理等结构化记录的 REST 接口。
 */
@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class RecordController {

    private final RecordService recordService;

    @GetMapping("/diet")
    public List<DietRecordResponse> getDietRecords(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return recordService.getDietRecords(SecurityUtils.currentUserId(), date, startDate, endDate);
    }

    @PostMapping("/diet")
    public DietRecordResponse addDietRecord(@Valid @RequestBody DietRecordRequest request) {
        return recordService.addDietRecord(SecurityUtils.currentUserId(), request);
    }

    @GetMapping("/exercise")
    public List<ExerciseRecordResponse> getExerciseRecords(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return recordService.getExerciseRecords(SecurityUtils.currentUserId(), date, startDate, endDate);
    }

    @PostMapping("/exercise")
    public ExerciseRecordResponse addExerciseRecord(@Valid @RequestBody ExerciseRecordRequest request) {
        return recordService.addExerciseRecord(SecurityUtils.currentUserId(), request);
    }

    @GetMapping("/steps")
    public List<StepRecordResponse> getStepRecords(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return recordService.getStepRecords(SecurityUtils.currentUserId(), date, startDate, endDate);
    }

    @PostMapping("/steps/sync")
    public List<StepRecordResponse> syncStepRecords(@Valid @RequestBody StepRecordSyncRequest request) {
        return recordService.syncStepRecords(SecurityUtils.currentUserId(), request);
    }

    @GetMapping("/care")
    public List<CareRecordResponse> getCareRecords(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return recordService.getCareRecords(SecurityUtils.currentUserId(), date, startDate, endDate);
    }

    @PostMapping("/care")
    public CareRecordResponse addCareRecord(@Valid @RequestBody CareRecordRequest request) {
        return recordService.addCareRecord(SecurityUtils.currentUserId(), request);
    }
}

