package com.healthtrack.mvp.service;

import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.domain.UserProfile;
import com.healthtrack.mvp.dto.ProfileDtos.ProfileRequest;
import com.healthtrack.mvp.dto.ProfileDtos.ProfileResponse;
import com.healthtrack.mvp.repository.UserProfileRepository;
import com.healthtrack.mvp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(Long userId) {
        User user = findUser(userId);
        UserProfile profile = getOrCreateProfile(user);
        return toResponse(user, profile);
    }

    @Transactional
    public ProfileResponse updateProfile(Long userId, ProfileRequest request) {
        User user = findUser(userId);
        UserProfile profile = getOrCreateProfile(user);

        if (StringUtils.hasText(request.nickname())) {
            user.setNickname(request.nickname().trim());
        }
        if (StringUtils.hasText(request.conditionLabel())) {
            profile.setConditionLabel(request.conditionLabel().trim());
        }
        if (StringUtils.hasText(request.fastingGlucoseBaseline())) {
            profile.setFastingGlucoseBaseline(request.fastingGlucoseBaseline().trim());
        }
        if (StringUtils.hasText(request.bloodPressureBaseline())) {
            profile.setBloodPressureBaseline(request.bloodPressureBaseline().trim());
        }
        if (request.restingHeartRate() != null) {
            profile.setRestingHeartRate(request.restingHeartRate());
        }
        if (StringUtils.hasText(request.medicationPlan())) {
            profile.setMedicationPlan(request.medicationPlan().trim());
        }
        if (StringUtils.hasText(request.notes())) {
            profile.setNotes(request.notes().trim());
        }
        if (request.age() != null) {
            profile.setAge(request.age());
        }
        if (StringUtils.hasText(request.gender())) {
            profile.setGender(request.gender().trim());
        }
        if (request.heightCm() != null) {
            profile.setHeightCm(request.heightCm());
        }
        if (request.weightKg() != null) {
            profile.setWeightKg(request.weightKg());
        }
        if (request.targetWeightKg() != null) {
            profile.setTargetWeightKg(request.targetWeightKg());
        }
        if (request.dailyCalorieGoal() != null) {
            profile.setDailyCalorieGoal(request.dailyCalorieGoal());
        }
        if (request.weeklyExerciseGoalMinutes() != null) {
            profile.setWeeklyExerciseGoalMinutes(request.weeklyExerciseGoalMinutes());
        }
        if (StringUtils.hasText(request.careFocus())) {
            profile.setCareFocus(request.careFocus().trim());
        }
        if (StringUtils.hasText(request.healthGoal())) {
            profile.setHealthGoal(request.healthGoal().trim());
        }

        userRepository.save(user);
        userProfileRepository.save(profile);
        return toResponse(user, profile);
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private UserProfile getOrCreateProfile(User user) {
        return userProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    UserProfile profile = new UserProfile();
                    profile.setUser(user);
                    profile.setConditionLabel("condition-pending");
                    profile.setHealthGoal("建立长期健康习惯");
                    return userProfileRepository.save(profile);
                });
    }

    private ProfileResponse toResponse(User user, UserProfile profile) {
        return new ProfileResponse(
                user.getEmail(),
                user.getNickname(),
                profile.getConditionLabel(),
                profile.getFastingGlucoseBaseline(),
                profile.getBloodPressureBaseline(),
                profile.getRestingHeartRate(),
                profile.getMedicationPlan(),
                profile.getNotes(),
                profile.getAge(),
                profile.getGender(),
                profile.getHeightCm(),
                profile.getWeightKg(),
                profile.getTargetWeightKg(),
                profile.getDailyCalorieGoal(),
                profile.getWeeklyExerciseGoalMinutes(),
                profile.getCareFocus(),
                profile.getHealthGoal(),
                profile.getUpdatedAt()
        );
    }
}

