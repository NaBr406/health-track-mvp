package com.healthtrack.mvp.service;

import com.healthtrack.mvp.domain.AiAdviceLog;
import com.healthtrack.mvp.domain.CareRecord;
import com.healthtrack.mvp.domain.DietRecord;
import com.healthtrack.mvp.domain.ExerciseRecord;
import com.healthtrack.mvp.domain.UserProfile;
import com.healthtrack.mvp.dto.DashboardDtos.DailySummaryPoint;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardSummaryResponse;
import com.healthtrack.mvp.repository.AiAdviceLogRepository;
import com.healthtrack.mvp.repository.CareRecordRepository;
import com.healthtrack.mvp.repository.DietRecordRepository;
import com.healthtrack.mvp.repository.ExerciseRecordRepository;
import com.healthtrack.mvp.repository.UserProfileRepository;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 仪表盘摘要服务。
 *
 * 这里负责把离散的结构化记录重新聚合成前端首页需要的“周视图 + 今日摘要”，
 * 同时补齐目标值、完成度和建议摘要等展示层所需信息。
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final Pattern CONTEXTUAL_GLUCOSE_PATTERN =
            Pattern.compile("(?i)(?:glucose|\\u8840\\u7cd6)[^\\d]*(\\d+(?:\\.\\d+)?)");
    private static final Pattern DECIMAL_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)");

    private final UserProfileRepository userProfileRepository;
    private final DietRecordRepository dietRecordRepository;
    private final ExerciseRecordRepository exerciseRecordRepository;
    private final CareRecordRepository careRecordRepository;
    private final AiAdviceLogRepository aiAdviceLogRepository;

    /**
     * 生成指定日期对应的仪表盘摘要。
     *
     * 默认会向前回看 7 天，用来构造前端的周活动列表和今日聚合指标。
     */
    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary(Long userId, LocalDate date) {
        LocalDate focusDate = date != null ? date : LocalDate.now();
        LocalDate weekStart = focusDate.minusDays(6);

        List<DietRecord> diets = dietRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, weekStart, focusDate);
        List<ExerciseRecord> exercises = exerciseRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, weekStart, focusDate);
        List<CareRecord> cares = careRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, weekStart, focusDate);
        UserProfile profile = userProfileRepository.findByUserId(userId).orElse(null);

        Map<LocalDate, Integer> caloriesByDate = new HashMap<>();
        Map<LocalDate, Integer> exerciseByDate = new HashMap<>();
        Map<LocalDate, Integer> careByDate = new HashMap<>();
        Map<LocalDate, Double> glucoseByDate = new HashMap<>();

        diets.forEach(record -> caloriesByDate.merge(record.getRecordedOn(), safeInt(record.getCalories()), Integer::sum));
        exercises.forEach(record -> exerciseByDate.merge(record.getRecordedOn(), safeInt(record.getDurationMinutes()), Integer::sum));
        cares.forEach(record -> careByDate.merge(record.getRecordedOn(), safeInt(record.getDurationMinutes()), Integer::sum));
        cares.forEach(record -> {
            // 旧数据可能只把血糖写在备注里，这里顺带补做一次解析以兼容历史记录。
            Double glucose = resolveGlucoseReading(record);
            if (glucose != null) {
                glucoseByDate.putIfAbsent(record.getRecordedOn(), glucose);
            }
        });

        int focusDietCount = (int) diets.stream().filter(record -> focusDate.equals(record.getRecordedOn())).count();
        int focusExerciseCount = (int) exercises.stream().filter(record -> focusDate.equals(record.getRecordedOn())).count();
        int focusCareCount = (int) cares.stream().filter(record -> focusDate.equals(record.getRecordedOn())).count();
        int focusCalories = caloriesByDate.getOrDefault(focusDate, 0);
        int focusExerciseMinutes = exerciseByDate.getOrDefault(focusDate, 0);
        int focusCareMinutes = careByDate.getOrDefault(focusDate, 0);
        int weeklyExerciseMinutes = exercises.stream()
                .map(ExerciseRecord::getDurationMinutes)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();

        int dailyCalorieGoal = profile != null && profile.getDailyCalorieGoal() != null ? profile.getDailyCalorieGoal() : 2000;
        int weeklyExerciseGoalMinutes = profile != null && profile.getWeeklyExerciseGoalMinutes() != null
                ? profile.getWeeklyExerciseGoalMinutes()
                : 150;

        List<DailySummaryPoint> weeklyActivity = IntStream.rangeClosed(0, 6)
                .mapToObj(index -> {
                    LocalDate currentDate = weekStart.plusDays(index);
                    return new DailySummaryPoint(
                            currentDate,
                            caloriesByDate.getOrDefault(currentDate, 0),
                            exerciseByDate.getOrDefault(currentDate, 0),
                            careByDate.getOrDefault(currentDate, 0),
                            glucoseByDate.get(currentDate)
                    );
                })
                .toList();

        String latestAdvice = aiAdviceLogRepository.findTopByUserIdAndAdviceDateOrderByCreatedAtDesc(userId, focusDate)
                .map(AiAdviceLog::getAdviceText)
                .orElse("今日还没有生成 AI 建议。");

        return new DashboardSummaryResponse(
                focusDate,
                focusDietCount,
                focusExerciseCount,
                focusCareCount,
                focusCalories,
                focusExerciseMinutes,
                focusCareMinutes,
                dailyCalorieGoal,
                weeklyExerciseGoalMinutes,
                calculateGoalCompletionRate(focusCalories, dailyCalorieGoal, weeklyExerciseMinutes, weeklyExerciseGoalMinutes),
                weeklyActivity,
                latestAdvice
        );
    }

    /**
     * 计算完成度。
     *
     * 当前实现把“热量接近日目标”和“周运动接近目标”做了一个简单加权，
     * 目的是给首页一个稳定、易理解的执行度指标，而不是医学评分。
     */
    private int calculateGoalCompletionRate(
            int focusCalories,
            int dailyCalorieGoal,
            int weeklyExerciseMinutes,
            int weeklyExerciseGoalMinutes
    ) {
        double calorieScore = dailyCalorieGoal <= 0
                ? 1.0
                : Math.max(0.0, 1.0 - Math.abs(focusCalories - dailyCalorieGoal) / (double) dailyCalorieGoal);
        double exerciseScore = weeklyExerciseGoalMinutes <= 0
                ? 1.0
                : Math.min(1.0, weeklyExerciseMinutes / (double) weeklyExerciseGoalMinutes);
        return (int) Math.round((calorieScore * 0.4 + exerciseScore * 0.6) * 100);
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    /**
     * 尝试从护理记录里解析血糖值。
     *
     * 兼容两种来源：
     * 1. 新结构里的 glucoseMmol 字段。
     * 2. 历史备注文本里带有“血糖 / glucose”关键字的自由文本。
     */
    private Double resolveGlucoseReading(CareRecord record) {
        if (record.getGlucoseMmol() != null) {
            return record.getGlucoseMmol();
        }

        if (!looksLikeGlucoseRecord(record) || !StringUtils.hasText(record.getNote())) {
            return null;
        }

        Matcher contextualMatcher = CONTEXTUAL_GLUCOSE_PATTERN.matcher(record.getNote());
        if (contextualMatcher.find()) {
            return Double.parseDouble(contextualMatcher.group(1));
        }

        Matcher decimalMatcher = DECIMAL_PATTERN.matcher(record.getNote());
        while (decimalMatcher.find()) {
            double candidate = Double.parseDouble(decimalMatcher.group(1));
            if (candidate >= 2d && candidate <= 25d) {
                return candidate;
            }
        }

        return null;
    }

    private boolean looksLikeGlucoseRecord(CareRecord record) {
        return containsGlucoseKeyword(record.getCategory())
                || containsGlucoseKeyword(record.getItemName())
                || containsGlucoseKeyword(record.getNote());
    }

    private boolean containsGlucoseKeyword(String value) {
        if (!StringUtils.hasText(value)) {
            return false;
        }

        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.contains("\u8840\u7cd6") || normalized.contains("glucose");
    }
}
