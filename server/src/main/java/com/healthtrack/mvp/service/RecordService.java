package com.healthtrack.mvp.service;

import com.healthtrack.mvp.domain.CareRecord;
import com.healthtrack.mvp.domain.DietRecord;
import com.healthtrack.mvp.domain.ExerciseRecord;
import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.dto.RecordDtos.CareRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.CareRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.DietRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.DietRecordResponse;
import com.healthtrack.mvp.dto.RecordDtos.ExerciseRecordRequest;
import com.healthtrack.mvp.dto.RecordDtos.ExerciseRecordResponse;
import com.healthtrack.mvp.repository.CareRecordRepository;
import com.healthtrack.mvp.repository.DietRecordRepository;
import com.healthtrack.mvp.repository.ExerciseRecordRepository;
import com.healthtrack.mvp.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class RecordService {

    private final UserRepository userRepository;
    private final DietRecordRepository dietRecordRepository;
    private final ExerciseRecordRepository exerciseRecordRepository;
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

    private CareRecordResponse toCareResponse(CareRecord record) {
        return new CareRecordResponse(
                record.getId(),
                record.getRecordedOn(),
                record.getCategory(),
                record.getItemName(),
                record.getDurationMinutes(),
                record.getStatus(),
                record.getNote(),
                record.getCreatedAt()
        );
    }

    private record DateRange(LocalDate startDate, LocalDate endDate) {
    }
}

