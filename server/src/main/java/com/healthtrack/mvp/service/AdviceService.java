package com.healthtrack.mvp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.healthtrack.mvp.domain.AiAdviceLog;
import com.healthtrack.mvp.domain.CareRecord;
import com.healthtrack.mvp.domain.DietRecord;
import com.healthtrack.mvp.domain.ExerciseRecord;
import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.domain.UserProfile;
import com.healthtrack.mvp.dto.AdviceDtos.DailyAdviceResponse;
import com.healthtrack.mvp.integration.dify.DifyClient;
import com.healthtrack.mvp.repository.AiAdviceLogRepository;
import com.healthtrack.mvp.repository.CareRecordRepository;
import com.healthtrack.mvp.repository.DietRecordRepository;
import com.healthtrack.mvp.repository.ExerciseRecordRepository;
import com.healthtrack.mvp.repository.UserProfileRepository;
import com.healthtrack.mvp.repository.UserRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AdviceService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final DietRecordRepository dietRecordRepository;
    private final ExerciseRecordRepository exerciseRecordRepository;
    private final CareRecordRepository careRecordRepository;
    private final AiAdviceLogRepository aiAdviceLogRepository;
    private final DifyClient difyClient;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Transactional
    public DailyAdviceResponse getDailyAdvice(Long userId, LocalDate targetDate) {
        LocalDate adviceDate = targetDate != null ? targetDate : LocalDate.now();

        return aiAdviceLogRepository.findTopByUserIdAndAdviceDateOrderByCreatedAtDesc(userId, adviceDate)
                .map(this::toResponse)
                .orElseGet(() -> generateAndSaveAdvice(userId, adviceDate));
    }

    @Transactional
    public DailyAdviceResponse refreshDailyAdvice(Long userId, LocalDate targetDate) {
        LocalDate adviceDate = targetDate != null ? targetDate : LocalDate.now();
        return generateAndSaveAdvice(userId, adviceDate);
    }

    private DailyAdviceResponse generateAndSaveAdvice(Long userId, LocalDate adviceDate) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        UserProfile profile = userProfileRepository.findByUserId(userId).orElse(null);
        List<DietRecord> dietRecords = dietRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, adviceDate, adviceDate);
        List<ExerciseRecord> exerciseRecords = exerciseRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, adviceDate, adviceDate);
        List<CareRecord> careRecords = careRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, adviceDate, adviceDate);

        Map<String, Object> payload = buildPayload(user, profile, adviceDate, dietRecords, exerciseRecords, careRecords);
        DifyClient.DifyAdviceResult result = difyClient.generateDailyAdvice(userId, adviceDate, payload)
                .orElseGet(() -> new DifyClient.DifyAdviceResult(
                        buildMockAdvice(profile, dietRecords, exerciseRecords, careRecords),
                        "mock",
                        "{\"message\":\"TODO: configure Dify credentials to enable real workflow execution\"}"
                ));

        AiAdviceLog log = new AiAdviceLog();
        log.setUser(user);
        log.setAdviceDate(adviceDate);
        log.setRequestPayload(writeJson(payload));
        log.setResponsePayload(result.rawResponse());
        log.setAdviceText(result.adviceText());
        log.setSource(result.source());
        log.setStatus("SUCCESS");
        return toResponse(aiAdviceLogRepository.save(log));
    }

    private Map<String, Object> buildPayload(
            User user,
            UserProfile profile,
            LocalDate adviceDate,
            List<DietRecord> dietRecords,
            List<ExerciseRecord> exerciseRecords,
            List<CareRecord> careRecords
    ) {
        int totalCalories = dietRecords.stream().map(DietRecord::getCalories).filter(java.util.Objects::nonNull).mapToInt(Integer::intValue).sum();
        int totalExerciseMinutes = exerciseRecords.stream().map(ExerciseRecord::getDurationMinutes).filter(java.util.Objects::nonNull).mapToInt(Integer::intValue).sum();
        int totalCareMinutes = careRecords.stream().map(CareRecord::getDurationMinutes).filter(java.util.Objects::nonNull).mapToInt(Integer::intValue).sum();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("date", adviceDate);
        payload.put("user", Map.of(
                "email", user.getEmail(),
                "nickname", user.getNickname()
        ));
        payload.put("profile", buildProfilePayload(profile));
        payload.put("summary", Map.of(
                "dietCount", dietRecords.size(),
                "exerciseCount", exerciseRecords.size(),
                "careCount", careRecords.size(),
                "totalCalories", totalCalories,
                "totalExerciseMinutes", totalExerciseMinutes,
                "totalCareMinutes", totalCareMinutes
        ));
        payload.put("dietRecords", dietRecords.stream().map(record -> Map.of(
                "mealType", record.getMealType(),
                "foodName", record.getFoodName(),
                "calories", record.getCalories(),
                "note", record.getNote() == null ? "" : record.getNote()
        )).toList());
        payload.put("exerciseRecords", exerciseRecords.stream().map(record -> Map.of(
                "activityName", record.getActivityName(),
                "durationMinutes", record.getDurationMinutes(),
                "caloriesBurned", record.getCaloriesBurned() == null ? 0 : record.getCaloriesBurned(),
                "intensity", record.getIntensity() == null ? "" : record.getIntensity()
        )).toList());
        payload.put("careRecords", careRecords.stream().map(record -> Map.of(
                "category", record.getCategory(),
                "itemName", record.getItemName(),
                "durationMinutes", record.getDurationMinutes() == null ? 0 : record.getDurationMinutes(),
                "status", record.getStatus() == null ? "" : record.getStatus()
        )).toList());
        return payload;
    }

    private String buildMockAdvice(
            UserProfile profile,
            List<DietRecord> dietRecords,
            List<ExerciseRecord> exerciseRecords,
            List<CareRecord> careRecords
    ) {
        int totalCalories = dietRecords.stream().map(DietRecord::getCalories).filter(java.util.Objects::nonNull).mapToInt(Integer::intValue).sum();
        int totalExerciseMinutes = exerciseRecords.stream().map(ExerciseRecord::getDurationMinutes).filter(java.util.Objects::nonNull).mapToInt(Integer::intValue).sum();

        String healthGoal = profile != null && profile.getHealthGoal() != null ? profile.getHealthGoal() : "维持更稳定的健康习惯";
        String careFocus = profile != null && profile.getCareFocus() != null ? profile.getCareFocus() : "基础护理";

        return """
                今日 AI 建议（Mock / TODO）：
                1. 当前目标聚焦：%s。
                2. 今日已记录饮食 %d 条，总摄入约 %d kcal；建议晚餐优先补充高纤维蔬菜与优质蛋白。
                3. 今日已记录运动 %d 条，总时长 %d 分钟；若精力允许，可加 10~15 分钟低强度拉伸恢复。
                4. 今日护理记录 %d 条，建议继续围绕「%s」形成固定时间段打卡。
                5. TODO：配置 Dify API Key 与 Workflow 后，这里将替换为真实工作流输出。
                """.formatted(
                healthGoal,
                dietRecords.size(),
                totalCalories,
                exerciseRecords.size(),
                totalExerciseMinutes,
                careRecords.size(),
                careFocus
        ).trim();
    }

    private Map<String, Object> buildProfilePayload(UserProfile profile) {
        if (profile == null) {
            return Map.of();
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("healthGoal", profile.getHealthGoal());
        payload.put("dailyCalorieGoal", profile.getDailyCalorieGoal());
        payload.put("weeklyExerciseGoalMinutes", profile.getWeeklyExerciseGoalMinutes());
        payload.put("careFocus", profile.getCareFocus());
        payload.put("weightKg", profile.getWeightKg());
        payload.put("targetWeightKg", profile.getTargetWeightKg());
        return payload;
    }

    private String writeJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{\"message\":\"serialization_failed\"}";
        }
    }

    private DailyAdviceResponse toResponse(AiAdviceLog log) {
        return new DailyAdviceResponse(
                log.getAdviceDate(),
                log.getAdviceText(),
                log.getSource(),
                log.getStatus(),
                log.getCreatedAt()
        );
    }
}
