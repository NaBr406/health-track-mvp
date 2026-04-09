package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.CareRecord;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CareRecordRepository extends JpaRepository<CareRecord, Long> {

    List<CareRecord> findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(
            Long userId, LocalDate startDate, LocalDate endDate);
}

