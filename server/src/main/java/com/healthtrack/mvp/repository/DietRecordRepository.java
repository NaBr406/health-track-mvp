package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.DietRecord;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietRecordRepository extends JpaRepository<DietRecord, Long> {

    List<DietRecord> findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(
            Long userId, LocalDate startDate, LocalDate endDate);
}

