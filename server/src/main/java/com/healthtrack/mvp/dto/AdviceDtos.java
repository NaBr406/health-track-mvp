package com.healthtrack.mvp.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

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

