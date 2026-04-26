package com.healthtrack.mvp.dto;

import com.healthtrack.mvp.dto.DashboardDtos.DashboardSnapshotResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 对话线程和聊天消息接口使用的 DTO 定义集合。
 */
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
            LocalDate focusDate,
            String timeZone
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
