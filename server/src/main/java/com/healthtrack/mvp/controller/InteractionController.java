package com.healthtrack.mvp.controller;

import com.healthtrack.mvp.dto.InteractionDtos.ChatThreadResponse;
import com.healthtrack.mvp.dto.InteractionDtos.InteractionMessageRequest;
import com.healthtrack.mvp.dto.InteractionDtos.InteractionMessageResponse;
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
@RequestMapping("/api/interaction")
@RequiredArgsConstructor
public class InteractionController {

    private final InteractionService interactionService;

    @GetMapping("/thread")
    public ChatThreadResponse getThread(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return interactionService.getThread(SecurityUtils.currentUserId(), date);
    }

    @PostMapping("/messages")
    public InteractionMessageResponse sendMessage(@RequestBody InteractionMessageRequest request) {
        return interactionService.sendMessage(SecurityUtils.currentUserId(), request);
    }
}
