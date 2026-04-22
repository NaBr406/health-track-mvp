package com.healthtrack.mvp.controller;

import com.healthtrack.mvp.dto.AdviceDtos.DailyAdviceResponse;
import com.healthtrack.mvp.service.AdviceService;
import com.healthtrack.mvp.util.SecurityUtils;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 每日 AI 建议相关的 REST 接口。
 */
@RestController
@RequestMapping("/api/advice")
@RequiredArgsConstructor
public class AdviceController {

    private final AdviceService adviceService;

    @GetMapping("/daily")
    public DailyAdviceResponse getDailyAdvice(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return adviceService.getDailyAdvice(SecurityUtils.currentUserId(), date);
    }
}

