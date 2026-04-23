package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.StepRecord;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StepRecordRepository extends JpaRepository<StepRecord, Long> {

    Optional<StepRecord> findByUserIdAndRecordedOn(Long userId, LocalDate recordedOn);

    List<StepRecord> findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescUpdatedAtDesc(
            Long userId,
            LocalDate startDate,
            LocalDate endDate
    );
}
