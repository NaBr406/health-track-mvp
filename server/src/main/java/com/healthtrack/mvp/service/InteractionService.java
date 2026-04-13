package com.healthtrack.mvp.service;

import com.healthtrack.mvp.domain.CareRecord;
import com.healthtrack.mvp.domain.DietRecord;
import com.healthtrack.mvp.domain.ExerciseRecord;
import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.domain.UserProfile;
import com.healthtrack.mvp.dto.AdviceDtos.DailyAdviceResponse;
import com.healthtrack.mvp.dto.DashboardDtos.AdjustmentFeedbackRequest;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardMetricResponse;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardSnapshotResponse;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardSummaryResponse;
import com.healthtrack.mvp.dto.DashboardDtos.MonitoringHistoryPointResponse;
import com.healthtrack.mvp.dto.DashboardDtos.PlanAdjustmentResponse;
import com.healthtrack.mvp.dto.InteractionDtos.ChatMessageResponse;
import com.healthtrack.mvp.dto.InteractionDtos.ChatThreadResponse;
import com.healthtrack.mvp.dto.InteractionDtos.InteractionMessageRequest;
import com.healthtrack.mvp.dto.InteractionDtos.InteractionMessageResponse;
import com.healthtrack.mvp.repository.CareRecordRepository;
import com.healthtrack.mvp.repository.DietRecordRepository;
import com.healthtrack.mvp.repository.ExerciseRecordRepository;
import com.healthtrack.mvp.repository.UserProfileRepository;
import com.healthtrack.mvp.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class InteractionService {

    private static final String DATA_SOURCE = "server";
    private static final double DEFAULT_SLEEP_HOURS = 6.5;
    private static final double DEFAULT_GLUCOSE = 7.2;

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final DietRecordRepository dietRecordRepository;
    private final ExerciseRecordRepository exerciseRecordRepository;
    private final CareRecordRepository careRecordRepository;
    private final DashboardService dashboardService;
    private final AdviceService adviceService;

    private final Map<String, CopyOnWriteArrayList<ChatMessageResponse>> threadStore = new ConcurrentHashMap<>();
    private final Map<String, DayState> dayStateStore = new ConcurrentHashMap<>();
    private final Map<String, String> feedbackStore = new ConcurrentHashMap<>();

    public ChatThreadResponse getThread(Long userId, LocalDate focusDate) {
        LocalDate date = resolveDate(focusDate);
        CopyOnWriteArrayList<ChatMessageResponse> thread = ensureThread(userId, date);
        return new ChatThreadResponse(date, List.copyOf(thread), DATA_SOURCE);
    }

    @Transactional
    public InteractionMessageResponse sendMessage(Long userId, InteractionMessageRequest request) {
        LocalDate focusDate = resolveDate(request.focusDate());
        String message = request.message() == null ? "" : request.message().trim();

        if (message.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message cannot be empty");
        }

        String inputMode = request.inputMode() == null ? "text" : request.inputMode().trim().toLowerCase(Locale.ROOT);
        CopyOnWriteArrayList<ChatMessageResponse> thread = ensureThread(userId, focusDate);
        thread.add(newMessage("user", message));

        ParsedInteraction parsed = parseMessage(message);
        List<String> changes = persistInteraction(userId, focusDate, message, inputMode, parsed);
        adviceService.refreshDailyAdvice(userId, focusDate);
        DashboardSnapshotResponse snapshot = getDashboardSnapshot(userId, focusDate);

        String responseText =
                changes.isEmpty()
                        ? "已收到这条%s描述，后端已归档原始事件。当前微调保持为 %s。".formatted("voice".equals(inputMode) ? "语音" : "文本", snapshot.adjustment().title())
                        : "已写入后端归档：%s。新的微调为 %s，%s %s。%s"
                                .formatted(
                                        String.join("，", changes),
                                        snapshot.adjustment().title(),
                                        snapshot.adjustment().parameterLabel(),
                                        snapshot.adjustment().parameterDelta(),
                                        snapshot.adjustment().summary()
                                );

        thread.add(newMessage("assistant", responseText));

        return new InteractionMessageResponse(focusDate, List.copyOf(thread), snapshot, DATA_SOURCE);
    }

    public DashboardSnapshotResponse submitAdjustmentFeedback(Long userId, AdjustmentFeedbackRequest request) {
        LocalDate focusDate = resolveDate(request.focusDate());
        String feedback = normalizeFeedback(request.feedback());
        feedbackStore.put(dayKey(userId, focusDate), feedback);

        CopyOnWriteArrayList<ChatMessageResponse> thread = ensureThread(userId, focusDate);
        thread.add(
                newMessage(
                        "system",
                        "accept".equals(feedback)
                                ? "已记录“认可”。这条反馈已送往后端校准占位链路。"
                                : "已记录“不太合适”。这条反馈已送往后端校准占位链路。"
                )
        );

        return getDashboardSnapshot(userId, focusDate);
    }

    public DashboardSnapshotResponse getDashboardSnapshot(Long userId, LocalDate focusDate) {
        LocalDate date = resolveDate(focusDate);
        DashboardSummaryResponse summary = dashboardService.getSummary(userId, date);
        DailyAdviceResponse advice = adviceService.getDailyAdvice(userId, date);
        UserProfile profile = userProfileRepository.findByUserId(userId).orElse(null);
        DayState dayState = dayStateStore.computeIfAbsent(dayKey(userId, date), ignored -> new DayState());

        double glucose = dayState.glucoseMmol() != null ? dayState.glucoseMmol() : DEFAULT_GLUCOSE;
        int steps = dayState.steps() != null ? dayState.steps() : Math.max(0, safeInt(summary.totalExerciseMinutes()) * 180);
        double sleepHours = dayState.sleepHours() != null ? dayState.sleepHours() : DEFAULT_SLEEP_HOURS;
        int calorieGap = Math.max(safeInt(summary.totalCalories()) - safeInt(summary.dailyCalorieGoal()), 0);
        String feedback = feedbackStore.get(dayKey(userId, date));
        AdjustmentModel adjustment = resolveAdjustment(glucose, steps, sleepHours, calorieGap, summary, advice, feedback);

        List<DashboardMetricResponse> metrics = List.of(
                new DashboardMetricResponse(
                        "glucose",
                        "血糖",
                        formatDecimal(glucose),
                        "mmol/L",
                        dayState.glucoseMmol() != null ? "今日对话监测" : "暂无实时回传，先展示默认基线",
                        dayState.glucoseMmol() != null ? "对话解析" : "默认基线"
                ),
                new DashboardMetricResponse(
                        "calories",
                        "热量",
                        String.valueOf(safeInt(summary.totalCalories())),
                        "kcal",
                        "今日总摄入",
                        "后端归档"
                ),
                new DashboardMetricResponse(
                        "exercise",
                        "运动",
                        String.valueOf(safeInt(summary.totalExerciseMinutes())),
                        "min",
                        "主动训练时长",
                        "后端归档"
                ),
                new DashboardMetricResponse(
                        "steps",
                        "步数",
                        String.valueOf(steps),
                        "步",
                        "低强度活动",
                        dayState.steps() != null ? "对话解析" : "运动时长推算"
                ),
                new DashboardMetricResponse(
                        "sleep",
                        "睡眠",
                        formatDecimal(sleepHours),
                        "h",
                        "恢复窗口",
                        dayState.sleepHours() != null ? "对话解析" : "默认回填"
                ),
                new DashboardMetricResponse(
                        "completion",
                        "完成度",
                        String.valueOf(safeInt(summary.goalCompletionRate())),
                        "%",
                        "综合执行估测",
                        "推演引擎"
                )
        );

        List<MonitoringHistoryPointResponse> history = summary.weeklyActivity().stream()
                .map(point -> {
                    boolean focusPoint = Objects.equals(point.date(), date);
                    return new MonitoringHistoryPointResponse(
                            point.date(),
                            safeInt(point.calories()),
                            safeInt(point.exerciseMinutes()),
                            focusPoint && dayState.steps() != null ? dayState.steps() : Math.max(0, safeInt(point.exerciseMinutes()) * 180),
                            focusPoint && dayState.sleepHours() != null ? dayState.sleepHours() : DEFAULT_SLEEP_HOURS,
                            focusPoint && dayState.glucoseMmol() != null ? dayState.glucoseMmol() : DEFAULT_GLUCOSE
                    );
                })
                .toList();

        String headline = profile != null && profile.getHealthGoal() != null
                ? "今日方案围绕“%s”展开，系统会根据你的对话归档持续微调。".formatted(profile.getHealthGoal())
                : "今日方案已根据后端归档和推演结果完成更新。";

        return new DashboardSnapshotResponse(
                date,
                headline,
                new PlanAdjustmentResponse(
                        "adjustment-" + date,
                        adjustment.title(),
                        advice.adviceText(),
                        adjustment.parameterLabel(),
                        adjustment.parameterDelta(),
                        adjustment.rationale(),
                        advice.generatedAt(),
                        feedback
                ),
                metrics,
                adjustment.observation(),
                advice.generatedAt(),
                history,
                DATA_SOURCE
        );
    }

    private CopyOnWriteArrayList<ChatMessageResponse> ensureThread(Long userId, LocalDate focusDate) {
        return threadStore.computeIfAbsent(
                dayKey(userId, focusDate),
                ignored -> {
                    DashboardSnapshotResponse snapshot = getDashboardSnapshot(userId, focusDate);
                    CopyOnWriteArrayList<ChatMessageResponse> seeded = new CopyOnWriteArrayList<>();
                    seeded.add(newMessage("assistant", "你好，这里是 AI 交流页。今天的行为、症状和监测结果都会直接写入后端。"));
                    seeded.add(
                            newMessage(
                                    "assistant",
                                    "今日微调建议：%s，%s %s。%s"
                                            .formatted(
                                                    snapshot.adjustment().title(),
                                                    snapshot.adjustment().parameterLabel(),
                                                    snapshot.adjustment().parameterDelta(),
                                                    snapshot.adjustment().summary()
                                            )
                            )
                    );
                    return seeded;
                }
        );
    }

    private List<String> persistInteraction(Long userId, LocalDate focusDate, String message, String inputMode, ParsedInteraction parsed) {
        User user = findUser(userId);
        DayState state = dayStateStore.computeIfAbsent(dayKey(userId, focusDate), ignored -> new DayState());
        List<String> changes = new ArrayList<>();
        boolean persisted = false;

        if (parsed.calories() != null) {
            DietRecord record = new DietRecord();
            record.setUser(user);
            record.setRecordedOn(focusDate);
            record.setMealType(inferMealType(message));
            record.setFoodName(inferFoodName(message));
            record.setCalories(parsed.calories());
            record.setNote(trimToLength(message, 300));
            dietRecordRepository.save(record);
            changes.add("热量 " + parsed.calories() + " kcal");
            persisted = true;
        }

        Integer exerciseMinutes = parsed.exerciseMinutes();
        if (exerciseMinutes == null && parsed.steps() != null) {
            exerciseMinutes = Math.max(5, Math.round(parsed.steps() / 180f));
        }

        if (exerciseMinutes != null) {
            ExerciseRecord record = new ExerciseRecord();
            record.setUser(user);
            record.setRecordedOn(focusDate);
            record.setActivityName(inferActivityName(message, parsed.steps()));
            record.setDurationMinutes(exerciseMinutes);
            record.setCaloriesBurned(Math.max(0, exerciseMinutes * 4));
            record.setIntensity(parsed.steps() != null && parsed.exerciseMinutes() == null ? "低" : "中");
            record.setNote(trimToLength(message, 300));
            exerciseRecordRepository.save(record);
            changes.add("运动 " + exerciseMinutes + " min");
            persisted = true;
        }

        if (parsed.steps() != null) {
            state.setSteps(parsed.steps());
            changes.add("步数 " + parsed.steps());
        }

        if (parsed.glucoseMmol() != null) {
            state.setGlucoseMmol(parsed.glucoseMmol());
            CareRecord record = new CareRecord();
            record.setUser(user);
            record.setRecordedOn(focusDate);
            record.setCategory("监测");
            record.setItemName("血糖记录");
            record.setDurationMinutes(0);
            record.setStatus("reported");
            record.setNote(trimToLength(message, 300));
            careRecordRepository.save(record);
            changes.add("血糖 " + formatDecimal(parsed.glucoseMmol()) + " mmol/L");
            persisted = true;
        }

        if (parsed.sleepHours() != null) {
            state.setSleepHours(parsed.sleepHours());
            CareRecord record = new CareRecord();
            record.setUser(user);
            record.setRecordedOn(focusDate);
            record.setCategory("恢复");
            record.setItemName("睡眠记录");
            record.setDurationMinutes((int) Math.round(parsed.sleepHours() * 60));
            record.setStatus("reported");
            record.setNote(trimToLength(message, 300));
            careRecordRepository.save(record);
            changes.add("睡眠 " + formatDecimal(parsed.sleepHours()) + " h");
            persisted = true;
        }

        if (!persisted) {
            CareRecord record = new CareRecord();
            record.setUser(user);
            record.setRecordedOn(focusDate);
            record.setCategory("行为回顾");
            record.setItemName("voice".equals(inputMode) ? "语音描述" : "文本描述");
            record.setDurationMinutes(0);
            record.setStatus("reported");
            record.setNote(trimToLength(message, 300));
            careRecordRepository.save(record);
        }

        return changes;
    }

    private ParsedInteraction parseMessage(String message) {
        String normalized = message.toLowerCase(Locale.ROOT);
        Integer steps = extractInt(message, "(\\d+)\\s*(?:步|steps?)");
        Integer calories = extractInt(message, "(\\d+)\\s*(?:kcal|千卡|卡路里|卡)\\b");
        Integer exerciseMinutes =
                containsAny(normalized, "走", "跑", "骑", "运动", "训练", "快走", "步行")
                        ? extractInt(message, "(\\d+)\\s*(?:分钟|分)\\b")
                        : null;
        Double glucose = extractDouble(message, "血糖[^\\d]*(\\d+(?:\\.\\d+)?)");
        Double sleepHours =
                containsAny(message, "睡", "睡眠", "入睡")
                        ? extractDouble(message, "(\\d+(?:\\.\\d+)?)\\s*(?:小时|h)\\b")
                        : null;

        return new ParsedInteraction(calories, exerciseMinutes, steps, glucose, sleepHours);
    }

    private AdjustmentModel resolveAdjustment(
            double glucose,
            int steps,
            double sleepHours,
            int calorieGap,
            DashboardSummaryResponse summary,
            DailyAdviceResponse advice,
            String feedback
    ) {
        String title = calorieGap > 0 ? "压缩碳水负荷" : "补齐活动窗口";
        String parameterLabel = calorieGap > 0 ? "CHO" : "ACT";
        String parameterDelta = calorieGap > 0 ? "-" + clampToFive(calorieGap / 30, 5, 25) + " g" : "+10 min";
        String rationale = "基于今日总摄入、活动量与对话归档综合推演。";
        String observation = advice.adviceText();

        if (glucose >= 8) {
            title = "抑制餐后波动";
            parameterLabel = "CHO";
            parameterDelta = "-18 g";
            rationale = "对话中识别到较高血糖值，优先压缩餐后波动。";
            observation = "系统判定当前主要风险来自餐后峰值，应优先调整主食负荷并补上餐后轻步行。";
        } else if (steps < 5000) {
            title = "补齐活动量";
            parameterLabel = "ACT";
            parameterDelta = "+12 min";
            rationale = "步数仍处于低位，先把低强度活动拉回稳定区间。";
            observation = "系统判定当前主要风险来自久坐与低活动量。";
        } else if (sleepHours < 6.5) {
            title = "修复恢复窗口";
            parameterLabel = "SLEEP";
            parameterDelta = "+0.5 h";
            rationale = "睡眠恢复不足时，额外加练的收益不如先补足恢复。";
            observation = "系统判定当前主要风险来自恢复窗口不足。";
        }

        if ("reject".equals(feedback)) {
            rationale = rationale + " 已收到“不太合适”反馈，等待下一轮后端校准。";
        } else if ("accept".equals(feedback)) {
            rationale = rationale + " 已收到“认可”反馈，将继续按此方向微调。";
        }

        return new AdjustmentModel(title, parameterLabel, parameterDelta, rationale, observation);
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private ChatMessageResponse newMessage(String role, String content) {
        return new ChatMessageResponse(role + "-" + UUID.randomUUID(), role, content, LocalDateTime.now());
    }

    private LocalDate resolveDate(LocalDate date) {
        return date != null ? date : LocalDate.now();
    }

    private String dayKey(Long userId, LocalDate date) {
        return userId + ":" + date;
    }

    private String normalizeFeedback(String feedback) {
        if ("accept".equals(feedback) || "reject".equals(feedback)) {
            return feedback;
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "feedback must be accept or reject");
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private Integer extractInt(String source, String regex) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.CASE_INSENSITIVE).matcher(source);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : null;
    }

    private Double extractDouble(String source, String regex) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.CASE_INSENSITIVE).matcher(source);
        return matcher.find() ? Double.parseDouble(matcher.group(1)) : null;
    }

    private boolean containsAny(String source, String... keywords) {
        for (String keyword : keywords) {
            if (source.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String inferMealType(String message) {
        if (containsAny(message, "早餐", "早饭")) {
            return "早餐";
        }
        if (containsAny(message, "午餐", "午饭")) {
            return "午餐";
        }
        if (containsAny(message, "晚餐", "晚饭")) {
            return "晚餐";
        }
        if (containsAny(message, "加餐", "零食")) {
            return "加餐";
        }
        return "对话记录";
    }

    private String inferFoodName(String message) {
        if (containsAny(message, "米饭")) {
            return "米饭/主食描述";
        }
        if (containsAny(message, "面", "面包")) {
            return "面食描述";
        }
        if (containsAny(message, "水果")) {
            return "水果摄入";
        }
        return trimToLength(message, 40);
    }

    private String inferActivityName(String message, Integer steps) {
        if (containsAny(message, "跑")) {
            return "跑步";
        }
        if (containsAny(message, "骑")) {
            return "骑行";
        }
        if (containsAny(message, "快走", "步行", "走") || steps != null) {
            return "步行";
        }
        return "对话记录运动";
    }

    private String trimToLength(String value, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private String formatDecimal(double value) {
        return String.format(Locale.US, "%.1f", value);
    }

    private int clampToFive(int multiplier, int min, int max) {
        int resolved = Math.max(min, Math.min(max, multiplier * 5));
        return Math.max(min, resolved);
    }

    private record ParsedInteraction(
            Integer calories,
            Integer exerciseMinutes,
            Integer steps,
            Double glucoseMmol,
            Double sleepHours
    ) {
    }

    private record AdjustmentModel(
            String title,
            String parameterLabel,
            String parameterDelta,
            String rationale,
            String observation
    ) {
    }

    private static final class DayState {
        private Integer steps;
        private Double glucoseMmol;
        private Double sleepHours;

        public Integer steps() {
            return steps;
        }

        public void setSteps(Integer steps) {
            this.steps = steps;
        }

        public Double glucoseMmol() {
            return glucoseMmol;
        }

        public void setGlucoseMmol(Double glucoseMmol) {
            this.glucoseMmol = glucoseMmol;
        }

        public Double sleepHours() {
            return sleepHours;
        }

        public void setSleepHours(Double sleepHours) {
            this.sleepHours = sleepHours;
        }
    }
}
