package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.DietRecord;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 饮食记录的 JPA 访问层。
 */
public interface DietRecordRepository extends JpaRepository<DietRecord, Long> {

    List<DietRecord> findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(
            Long userId, LocalDate startDate, LocalDate endDate);
}

