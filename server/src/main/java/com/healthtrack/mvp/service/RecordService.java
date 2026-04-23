package com.healthtrack.mvp.service;

import com.healthtrack.mvp.domain.CareRecord;
import com.healthtrack.mvp.domain.DietRecord;
import com.healthtrack.mvp.domain.ExerciseRecord;
import com.healthtrack.mvp.domain.StepRecord;
import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.dto.RecordDtos.CareRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.CareRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.DietRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.DietRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.ExerciseRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.ExerciseRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.StepRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.StepRecordSyncItemRequest;
import com.healthtrack.mvp.dto.RecordDtos.StepRecordSyncRequest;
import com.healthtrack.mvp.repository.CareRecordRepository;
import com.healthtrack.mvp.repository.DietRecordRepository;
import com.healthtrack.mvp.repository.ExerciseRecordRepository;
import com.healthtrack.mvp.repository.StepRecordRepository;
import com.healthtrack.mvp.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * 负责饮食、运动、护理三类结构化记录的增查业务。
 */
@Service
@RequiredArgsConstructor
public class RecordService {

    private final UserRepository userRepository;
    private final DietRecordRepository dietRecordRepository;
    private final ExerciseRecordRepository exerciseRecordRepository;
    private final StepRecordRepository stepRecordRepository;
    private final CareRecordRepository careRecordRepository;

    @Transactional(readOnly = true)
    public List<DietRecordResponse> getDietRecords(Long userId, LocalDate date, LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveRange(date, startDate, endDate);
        return dietRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, range.startDate(), range.endDate())
                .stream()
                .map(this::toDietResponse)
                .toList();
    }

    @Transactional
    public DietRecordResponse addDietRecord(Long userId, DietRecordRequest request) {
        User user = findUser(userId);
        DietRecord record = new DietRecord();
        record.setUser(user);
        record.setRecordedOn(request.recordedOn());
        record.setMealType(request.mealType());
        record.setFoodName(request.foodName());
        record.setCalories(request.calories());
        record.setProteinGrams(request.proteinGrams());
        record.setCarbsGrams(request.carbsGrams());
        record.setFatGrams(request.fatGrams());
        record.setNote(request.note());
        return toDietResponse(dietRecordRepository.save(record));
    }

    @Transactional(readOnly = true)
    public List<ExerciseRecordResponse> getExerciseRecords(Long userId, LocalDate date, LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveRange(date, startDate, endDate);
        return exerciseRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, range.startDate(), range.endDate())
                .stream()
                .map(this::toExerciseResponse)
                .toList();
    }

    @Transactional
    public ExerciseRecordResponse addExerciseRecord(Long userId, ExerciseRecordRequest request) {
        User user = findUser(userId);
        ExerciseRecord record = new ExerciseRecord();
        record.setUser(user);
        record.setRecordedOn(request.recordedOn());
        record.setActivityName(request.activityName());
        record.setDurationMinutes(request.durationMinutes());
        record.setCaloriesBurned(request.caloriesBurned());
        record.setIntensity(request.intensity());
        record.setNote(request.note());
        return toExerciseResponse(exerciseRecordRepository.save(record));
    }

    @Transactional(readOnly = true)
    public List<StepRecordResponse> getStepRecords(Long userId, LocalDate date, LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveRange(date, startDate, endDate);
        return stepRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescUpdatedAtDesc(userId, range.startDate(), range.endDate())
                .stream()
                .map(this::toStepResponse)
                .toList();
    }

    @Transactional
    public List<StepRecordResponse> syncStepRecords(Long userId, StepRecordSyncRequest request) {
        User user = findUser(userId);
        Map<LocalDate, StepRecordSyncItemRequest> latestItemsByDate = new LinkedHashMap<>();
        request.records().forEach(item -> latestItemsByDate.put(item.recordedOn(), item));
        List<StepRecordSyncItemRequest> items = List.copyOf(latestItemsByDate.values());

        LocalDate minDate = items.stream()
                .map(StepRecordSyncItemRequest::recordedOn)
                .min(LocalDate::compareTo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "records cannot be empty"));
        LocalDate maxDate = items.stream()
                .map(StepRecordSyncItemRequest::recordedOn)
                .max(LocalDate::compareTo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "records cannot be empty"));

        Map<LocalDate, StepRecord> existingByDate = new HashMap<>();
        stepRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescUpdatedAtDesc(userId, minDate, maxDate)
                .forEach(record -> existingByDate.put(record.getRecordedOn(), record));

        List<StepRecord> saved = items.stream()
                .map(item -> upsertStepRecord(existingByDate.get(item.recordedOn()), user, item))
                .map(stepRecordRepository::save)
                .sorted(Comparator.comparing(StepRecord::getRecordedOn).reversed())
                .toList();

        return saved.stream()
                .map(this::toStepResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CareRecordResponse> getCareRecords(Long userId, LocalDate date, LocalDate startDate, LocalDate endDate) {
        DateRange range = resolveRange(date, startDate, endDate);
        return careRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, range.startDate(), range.endDate())
                .stream()
                .map(this::toCareResponse)
                .toList();
    }

    @Transactional
    public CareRecordResponse addCareRecord(Long userId, CareRecordRequest request) {
        User user = findUser(userId);
        CareRecord record = new CareRecord();
        record.setUser(user);
        record.setRecordedOn(request.recordedOn());
        record.setCategory(request.category());
        record.setItemName(request.itemName());
        record.setDurationMinutes(request.durationMinutes());
        record.setStatus(request.status());
        record.setNote(request.note());
        record.setGlucoseMmol(request.glucoseMmol());
        return toCareResponse(careRecordRepository.save(record));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private DateRange resolveRange(LocalDate date, LocalDate startDate, LocalDate endDate) {
        if (date != null) {
            return new DateRange(date, date);
        }
        LocalDate resolvedEnd = endDate != null ? endDate : LocalDate.now();
        LocalDate resolvedStart = startDate != null ? startDate : resolvedEnd.minusDays(6);
        if (resolvedStart.isAfter(resolvedEnd)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startDate cannot be after endDate");
        }
        return new DateRange(resolvedStart, resolvedEnd);
    }

    private DietRecordResponse toDietResponse(DietRecord record) {
        return new DietRecordResponse(
                record.getId(),
                record.getRecordedOn(),
                record.getMealType(),
                record.getFoodName(),
                record.getCalories(),
                record.getProteinGrams(),
                record.getCarbsGrams(),
                record.getFatGrams(),
                record.getNote(),
                record.getCreatedAt()
        );
    }

    private ExerciseRecordResponse toExerciseResponse(ExerciseRecord record) {
        return new ExerciseRecordResponse(
                record.getId(),
                record.getRecordedOn(),
                record.getActivityName(),
                record.getDurationMinutes(),
                record.getCaloriesBurned(),
                record.getIntensity(),
                record.getNote(),
                record.getCreatedAt()
        );
    }

    private StepRecord upsertStepRecord(StepRecord existing, User user, StepRecordSyncItemRequest request) {
        StepRecord record = existing != null ? existing : new StepRecord();
        int requestedSteps = Math.max(request.steps(), 0);
        int existingSteps = existing != null ? Math.max(existing.getSteps(), 0) : 0;
        boolean shouldReplace = existing == null || requestedSteps >= existingSteps || shouldReplaceLegacyStepSource(existing, request);
        record.setUser(user);
        record.setRecordedOn(request.recordedOn());
        record.setSteps(shouldReplace ? requestedSteps : existingSteps);
        if (shouldReplace) {
            record.setSource(normalizeSource(request.source()));
            record.setSourceDevice(normalizeOptionalText(request.sourceDevice()));
            record.setSourceTimeZone(normalizeOptionalText(request.sourceTimeZone()));
            record.setSyncedAt(request.syncedAt() != null ? request.syncedAt() : LocalDateTime.now());
        }
        return record;
    }

    private boolean shouldReplaceLegacyStepSource(StepRecord existing, StepRecordSyncItemRequest request) {
        String incomingSource = normalizeSource(request.source());
        String existingSource = normalizeOptionalText(existing.getSource());
        return "设备传感器".equals(incomingSource) && !"设备传感器".equals(existingSource);
    }

    private StepRecordResponse toStepResponse(StepRecord record) {
        return new StepRecordResponse(
                record.getId(),
                record.getRecordedOn(),
                record.getSteps(),
                record.getSource(),
                record.getSourceDevice(),
                record.getSourceTimeZone(),
                record.getSyncedAt(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private CareRecordResponse toCareResponse(CareRecord record) {
        return new CareRecordResponse(
                record.getId(),
                record.getRecordedOn(),
                record.getCategory(),
                record.getItemName(),
                record.getDurationMinutes(),
                record.getStatus(),
                record.getNote(),
                record.getGlucoseMmol(),
                record.getCreatedAt()
        );
    }

    private String normalizeSource(String value) {
        String normalized = normalizeOptionalText(value);
        return normalized != null ? normalized : "设备传感器";
    }

    private String normalizeOptionalText(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private record DateRange(LocalDate startDate, LocalDate endDate) {
    }
}

