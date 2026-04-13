package com.healthtrack.mvp.dto;

import com.healthtrack.mvp.dto.DashboardDtos.DashboardSnapshotResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class InteractionDtos {

    private InteractionDtos() {
    }

    public record ChatMessageResponse(
            String id,
            String role,
            String content,
            LocalDateTime createdAt
    ) {
    }

    public record ChatThreadResponse(
            LocalDate focusDate,
            List<ChatMessageResponse> messages,
            String dataSource
    ) {
    }

    public record InteractionMessageRequest(
            String message,
            String inputMode,
            LocalDate focusDate
    ) {
    }

    public record InteractionMessageResponse(
            LocalDate focusDate,
            List<ChatMessageResponse> messages,
            DashboardSnapshotResponse dashboard,
            String dataSource
    ) {
    }
}
