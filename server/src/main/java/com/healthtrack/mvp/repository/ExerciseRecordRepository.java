package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.ExerciseRecord;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExerciseRecordRepository extends JpaRepository<ExerciseRecord, Long> {

    List<ExerciseRecord> findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(
            Long userId, LocalDate startDate, LocalDate endDate);
}

