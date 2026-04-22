package com.healthtrack.mvp.controller;

import com.healthtrack.mvp.dto.ProfileDtos.ProfileRequest;
import com.healthtrack.mvp.dto.ProfileDtos.ProfileResponse;
import com.healthtrack.mvp.service.ProfileService;
import com.healthtrack.mvp.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户健康档案读取与更新相关的 REST 接口。
 */
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping
    public ProfileResponse getProfile() {
        return profileService.getProfile(SecurityUtils.currentUserId());
    }

    @PutMapping
    public ProfileResponse updateProfile(@RequestBody ProfileRequest request) {
        return profileService.updateProfile(SecurityUtils.currentUserId(), request);
    }
}

