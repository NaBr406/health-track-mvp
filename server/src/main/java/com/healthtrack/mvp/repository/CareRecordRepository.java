package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.CareRecord;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 护理与监测记录的 JPA 访问层。
 */
public interface CareRecordRepository extends JpaRepository<CareRecord, Long> {

    List<CareRecord> findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(
            Long userId, LocalDate startDate, LocalDate endDate);
}

