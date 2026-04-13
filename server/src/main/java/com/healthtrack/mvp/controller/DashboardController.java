package com.healthtrack.mvp.controller;

import com.healthtrack.mvp.dto.DashboardDtos.AdjustmentFeedbackRequest;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardSnapshotResponse;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardSummaryResponse;
import com.healthtrack.mvp.service.DashboardService;
import com.healthtrack.mvp.service.InteractionService;
import com.healthtrack.mvp.util.SecurityUtils;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final InteractionService interactionService;

    @GetMapping("/summary")
    public DashboardSummaryResponse getSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return dashboardService.getSummary(SecurityUtils.currentUserId(), date);
    }

    @GetMapping("/snapshot")
    public DashboardSnapshotResponse getSnapshot(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return interactionService.getDashboardSnapshot(SecurityUtils.currentUserId(), date);
    }

    @PostMapping("/adjustment-feedback")
    public DashboardSnapshotResponse submitAdjustmentFeedback(@RequestBody AdjustmentFeedbackRequest request) {
        return interactionService.submitAdjustmentFeedback(SecurityUtils.currentUserId(), request);
    }
}

