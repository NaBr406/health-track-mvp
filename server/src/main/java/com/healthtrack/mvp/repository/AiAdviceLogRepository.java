package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.AiAdviceLog;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiAdviceLogRepository extends JpaRepository<AiAdviceLog, Long> {

    Optional<AiAdviceLog> findTopByUserIdAndAdviceDateOrderByCreatedAtDesc(Long userId, LocalDate adviceDate);
}

