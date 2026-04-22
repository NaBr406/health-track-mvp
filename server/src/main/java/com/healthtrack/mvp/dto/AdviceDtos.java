package com.healthtrack.mvp.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * AI 建议接口使用的 DTO 定义集合。
 */
public final class AdviceDtos {

    private AdviceDtos() {
    }

    public record DailyAdviceResponse(
            LocalDate adviceDate,
            String adviceText,
            String source,
            String status,
            LocalDateTime generatedAt
    ) {
    }
}

