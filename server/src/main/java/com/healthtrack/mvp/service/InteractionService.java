package com.healthtrack.mvp.service;

import com.healthtrack.mvp.domain.CareRecord;
import com.healthtrack.mvp.domain.DietRecord;
import com.healthtrack.mvp.domain.ExerciseRecord;
import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.domain.UserProfile;
import com.healthtrack.mvp.dto.AdviceDtos.DailyAdviceResponse;
import com.healthtrack.mvp.dto.DashboardDtos.AdjustmentFeedbackRequest;
import com.healthtrack.mvp.dto.DashboardDtos.DailySummaryPoint;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardMetricResponse;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardSnapshotResponse;
import com.healthtrack.mvp.dto.DashboardDtos.DashboardSummaryResponse;
import com.healthtrack.mvp.dto.DashboardDtos.GlucoseForecastPointResponse;
import com.healthtrack.mvp.dto.DashboardDtos.MonitoringHistoryPointResponse;
import com.healthtrack.mvp.dto.DashboardDtos.PlanAdjustmentResponse;
import com.healthtrack.mvp.dto.InteractionDtos.ChatMessageResponse;
import com.healthtrack.mvp.dto.InteractionDtos.ChatThreadResponse;
import com.healthtrack.mvp.dto.InteractionDtos.InteractionMessageRequest;
import com.healthtrack.mvp.dto.InteractionDtos.InteractionMessageResponse;
import com.healthtrack.mvp.integration.dify.DifyRecordExtractorClient;
import com.healthtrack.mvp.repository.CareRecordRepository;
import com.healthtrack.mvp.repository.DietRecordRepository;
import com.healthtrack.mvp.repository.ExerciseRecordRepository;
import com.healthtrack.mvp.repository.UserProfileRepository;
import com.healthtrack.mvp.repository.UserRepository;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/**
 * 对话交互服务。
 *
 * 这里把“聊天”真正接成了业务入口：
 * 1. 维护按用户和日期隔离的线程视图。
 * 2. 解析消息中的结构化健康信息。
 * 3. 写入正式记录，并同步刷新建议与仪表盘快照。
 */
@Service
@RequiredArgsConstructor
public class InteractionService {

    private static final String DEVICE_STEP_COUNTER_PENDING_SOURCE = "已启用设备计步，等待下一次采样";

    private static final String DATA_SOURCE = "server";
    private static final double DEFAULT_SLEEP_HOURS = 6.5;
    private static final double DEFAULT_GLUCOSE = 7.2;
    private static final List<Integer> REQUIRED_FORECAST_HOUR_OFFSETS = List.of(0, 1, 2, 4, 6, 8);
    private static final Pattern GLUCOSE_NUMBER_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)");

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final DietRecordRepository dietRecordRepository;
    private final ExerciseRecordRepository exerciseRecordRepository;
    private final CareRecordRepository careRecordRepository;
    private final DashboardService dashboardService;
    private final AdviceService adviceService;
    private final DifyRecordExtractorClient difyRecordExtractorClient;

    private final Map<String, CopyOnWriteArrayList<ChatMessageResponse>> threadStore = new ConcurrentHashMap<>();
    private final Map<String, InteractionDayState> dayStateStore = new ConcurrentHashMap<>();
    private final Map<String, String> feedbackStore = new ConcurrentHashMap<>();

    /**
     * 获取指定日期的对话线程。
     *
     * 如果线程不存在，会按当天快照自动种出一组欢迎消息和初始建议。
     */
    public ChatThreadResponse getThread(Long userId, LocalDate focusDate) {
        LocalDate date = resolveDate(focusDate);
        CopyOnWriteArrayList<ChatMessageResponse> thread = ensureThread(userId, date);
        return new ChatThreadResponse(date, List.copyOf(thread), DATA_SOURCE);
    }

    /**
     * 处理一条新的聊天消息。
     *
     * 这个入口会串起“入线程 -> 解析 -> 落库 -> 刷新建议 -> 回写助手回复”整条链路。
     */
    @Transactional
    public InteractionMessageResponse sendMessage(Long userId, InteractionMessageRequest request) {
        UserTimeContext userTimeContext = resolveUserTimeContext(request.timeZone());
        LocalDate focusDate = resolveDate(request.focusDate(), userTimeContext);
        String message = request.message() == null ? "" : request.message().trim();

        if (message.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message cannot be empty");
        }

        String inputMode = request.inputMode() == null ? "text" : request.inputMode().trim().toLowerCase(Locale.ROOT);
        CopyOnWriteArrayList<ChatMessageResponse> thread = ensureThread(userId, focusDate);
        thread.add(newMessage("user", message));

        ParsedInteraction parsed = parseMessage(userId, focusDate, message, userTimeContext);
        List<String> changes = persistInteraction(userId, focusDate, message, inputMode, parsed, userTimeContext);
        adviceService.refreshDailyAdvice(userId, focusDate);
        DashboardSnapshotResponse snapshot = getDashboardSnapshot(userId, focusDate);

        String responseText;
        if (changes.isEmpty()) {
            responseText = "已收到这条%s描述，原始事件已经归档，当前建议仍为%s。"
                    .formatted("voice".equals(inputMode) ? "语音" : "文本", snapshot.adjustment().title());
        } else {
            responseText = "已写入后端归档：%s。当前建议更新为%s，%s %s。%s"
                    .formatted(
                            String.join("、", changes),
                            snapshot.adjustment().title(),
                            snapshot.adjustment().parameterLabel(),
                            snapshot.adjustment().parameterDelta(),
                            snapshot.adjustment().summary()
                    );
        }

        if (Boolean.TRUE.equals(parsed.needsFollowup()) && StringUtils.hasText(parsed.followupQuestion())) {
            responseText = responseText + " " + parsed.followupQuestion();
        }

        thread.add(newMessage("assistant", responseText));
        return new InteractionMessageResponse(focusDate, List.copyOf(thread), snapshot, DATA_SOURCE);
    }

    /**
     * 记录用户对当前调整建议的反馈，并立刻返回最新快照。
     */
    public DashboardSnapshotResponse submitAdjustmentFeedback(Long userId, AdjustmentFeedbackRequest request) {
        LocalDate focusDate = resolveDate(request.focusDate());
        String feedback = normalizeFeedback(request.feedback());
        feedbackStore.put(dayKey(userId, focusDate), feedback);

        CopyOnWriteArrayList<ChatMessageResponse> thread = ensureThread(userId, focusDate);
        thread.add(
                newMessage(
                        "system",
                        "accept".equals(feedback)
                                ? "已记录“认可”。这条反馈会用于下一轮建议校准。"
                                : "已记录“不太合适”。这条反馈会用于下一轮建议校准。"
                )
        );

        return getDashboardSnapshot(userId, focusDate);
    }

    /**
     * 生成当前日期的聊天版仪表盘快照。
     *
     * 与纯摘要服务不同，这里还会叠加当天会话里尚未完全沉淀到结构化表的数据状态，
     * 比如临时步数、睡眠和预测结果。
     */
    public DashboardSnapshotResponse getDashboardSnapshot(Long userId, LocalDate focusDate) {
        LocalDate date = resolveDate(focusDate);
        // 仪表盘快照会混合持久化数据和当天对话里推导出的临时状态。
        DashboardSummaryResponse summary = dashboardService.getSummary(userId, date);
        DailyAdviceResponse advice = adviceService.getDailyAdvice(userId, date);
        UserProfile profile = userProfileRepository.findByUserId(userId).orElse(null);
        InteractionDayState dayState = dayStateStore.computeIfAbsent(dayKey(userId, date), ignored -> new InteractionDayState());
        DailySummaryPoint focusSummaryPoint = summary.weeklyActivity().stream()
                .filter(point -> Objects.equals(point.date(), date))
                .findFirst()
                .orElse(null);
        Double recordedGlucose = summary.weeklyActivity().stream()
                .filter(point -> Objects.equals(point.date(), date))
                .map(point -> point.glucoseMmol())
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        double glucose = resolveDashboardGlucose(dayState, recordedGlucose);
        int steps = resolveDashboardSteps(dayState, focusSummaryPoint, summary.totalExerciseMinutes());
        String stepMetricSource = resolveDashboardStepMetricSource(dayState, focusSummaryPoint, summary.totalExerciseMinutes());
        double sleepHours = dayState.sleepHours() != null ? dayState.sleepHours() : DEFAULT_SLEEP_HOURS;
        int calorieGap = Math.max(safeInt(summary.totalCalories()) - safeInt(summary.dailyCalorieGoal()), 0);
        String feedback = feedbackStore.get(dayKey(userId, date));
        AdjustmentModel adjustment = resolveAdjustment(glucose, steps, sleepHours, calorieGap, advice, feedback, dayState);

        List<DashboardMetricResponse> metrics = List.of(
                new DashboardMetricResponse("glucose", "血糖", formatDecimal(glucose), "mmol/L", resolveGlucoseMetricDescriptor(dayState, recordedGlucose), resolveGlucoseMetricSource(dayState, recordedGlucose)),
                new DashboardMetricResponse("calories", "热量", String.valueOf(safeInt(summary.totalCalories())), "kcal", "今日总摄入", "后端归档"),
                new DashboardMetricResponse("exercise", "运动", String.valueOf(safeInt(summary.totalExerciseMinutes())), "min", "主动训练时长", "后端归档"),
                new DashboardMetricResponse("steps", "步数", String.valueOf(steps), "步", "低强度活动", stepMetricSource),
                new DashboardMetricResponse("sleep", "睡眠", formatDecimal(sleepHours), "h", "恢复窗口", dayState.sleepHours() != null ? "对话解析" : "默认回填"),
                new DashboardMetricResponse("completion", "完成度", String.valueOf(safeInt(summary.goalCompletionRate())), "%", "综合执行估计", "推演引擎")
        );

        List<MonitoringHistoryPointResponse> history = summary.weeklyActivity().stream()
                .map(point -> {
                    boolean focusPoint = Objects.equals(point.date(), date);
                    Double historyGlucose = point.glucoseMmol();
                    String glucoseSource = historyGlucose != null ? "recorded" : "default";

                    if (focusPoint && historyGlucose == null && (dayState.glucoseMmol() != null || dayState.forecastAnchorGlucoseMmol() != null)) {
                        historyGlucose = glucose;
                        glucoseSource = "derived";
                    }

                    return new MonitoringHistoryPointResponse(
                            point.date(),
                            safeInt(point.calories()),
                            safeInt(point.exerciseMinutes()),
                            resolveHistorySteps(point, focusPoint, dayState),
                            resolveHistoryStepSource(point, focusPoint, dayState),
                            focusPoint && dayState.sleepHours() != null ? dayState.sleepHours() : DEFAULT_SLEEP_HOURS,
                            historyGlucose != null ? historyGlucose : DEFAULT_GLUCOSE,
                            glucoseSource
                    );
                })
                .toList();

        List<GlucoseForecastPointResponse> glucoseForecast = dayState.glucoseForecast8h().stream()
                .map(point -> new GlucoseForecastPointResponse(point.hourOffset(), point.predictedGlucoseMmol(), point.pointType()))
                .toList();

        String headline = profile != null && StringUtils.hasText(profile.getHealthGoal())
                ? "今日方案围绕“%s”展开，系统会根据你的对话归档持续微调。".formatted(profile.getHealthGoal())
                : "今日方案已根据后端归档和模型推演完成更新。";

        return new DashboardSnapshotResponse(
                date,
                headline,
                new PlanAdjustmentResponse("adjustment-" + date, adjustment.title(), advice.adviceText(), adjustment.parameterLabel(), adjustment.parameterDelta(), adjustment.rationale(), advice.generatedAt(), feedback),
                metrics,
                adjustment.observation(),
                advice.generatedAt(),
                history,
                dayState.glucoseRiskLevel(),
                dayState.calibrationApplied(),
                dayState.peakGlucoseMmol(),
                dayState.peakHourOffset(),
                dayState.returnToBaselineHourOffset(),
                glucoseForecast,
                dayState.forecastSource(),
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

    /**
     * 把解析结果落成正式记录，并同步更新当天的临时推导状态。
     *
     * 返回值是本次消息实际造成的“变化摘要”，供助手回复直接复述给用户。
     */
    private List<String> persistInteraction(
            Long userId,
            LocalDate focusDate,
            String message,
            String inputMode,
            ParsedInteraction parsed,
            UserTimeContext userTimeContext
    ) {
        User user = findUser(userId);
        InteractionDayState state = dayStateStore.computeIfAbsent(dayKey(userId, focusDate), ignored -> new InteractionDayState());
        List<String> changes = new ArrayList<>();
        boolean persisted = false;

        if (parsed.calories() != null) {
            // 能直接结构化的内容优先落成正式记录，后续摘要和建议都会复用这些数据。
            DietRecord record = new DietRecord();
            record.setUser(user);
            record.setRecordedOn(focusDate);
            record.setMealType(InteractionTextSupport.resolveMealType(parsed, message));
            record.setFoodName(InteractionTextSupport.resolveFoodName(parsed, message));
            record.setCalories(parsed.calories());
            record.setNote(InteractionTextSupport.trimToLength(message, 300));
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
            record.setActivityName(InteractionTextSupport.resolveActivityName(parsed, message, parsed.steps()));
            record.setDurationMinutes(exerciseMinutes);
            record.setCaloriesBurned(Math.max(0, exerciseMinutes * 4));
            record.setIntensity(parsed.steps() != null && parsed.exerciseMinutes() == null ? "低" : "中");
            record.setNote(InteractionTextSupport.trimToLength(message, 300));
            exerciseRecordRepository.save(record);
            changes.add("运动 " + exerciseMinutes + " min");
            persisted = true;
        }

        if (parsed.steps() != null) {
            state.setSteps(parsed.steps());
            changes.add("步数 " + parsed.steps());
        }

        if (parsed.hasForecastData()) {
            applyForecastToState(
                    state,
                    new ForecastComputation(
                            parsed.glucoseRiskLevel(),
                            parsed.calibrationApplied(),
                            parsed.peakGlucoseMmol(),
                            parsed.peakHourOffset(),
                            parsed.returnToBaselineHourOffset(),
                            parsed.glucoseForecast8h(),
                            parsed.forecastAnchorGlucoseMmol()
                    ),
                    "dify"
            );
            changes.add("8 小时血糖预测");
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
            record.setNote(InteractionTextSupport.trimToLength(message, 300));
            record.setGlucoseMmol(parsed.glucoseMmol());
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
            record.setNote(InteractionTextSupport.trimToLength(message, 300));
            careRecordRepository.save(record);
            changes.add("睡眠 " + formatDecimal(parsed.sleepHours()) + " h");
            persisted = true;
        }

        if (!parsed.hasForecastData()) {
            ForecastComputation fallbackForecast = buildFallbackForecast(
                    parsed,
                    state,
                    message,
                    userTimeContext,
                    userProfileRepository.findByUserId(userId).orElse(null)
            );
            if (fallbackForecast != null) {
                applyForecastToState(state, fallbackForecast, "local");
                changes.add(Boolean.TRUE.equals(fallbackForecast.calibrationApplied()) ? "血糖预测校准" : "8 小时血糖预测");
            }
        }

        if (!persisted) {
            CareRecord record = new CareRecord();
            record.setUser(user);
            record.setRecordedOn(focusDate);
            record.setCategory("行为回顾");
            record.setItemName("voice".equals(inputMode) ? "语音描述" : "文本描述");
            record.setDurationMinutes(0);
            record.setStatus("reported");
            record.setNote(InteractionTextSupport.trimToLength(message, 300));
            careRecordRepository.save(record);
        }

        return changes;
    }

    /**
     * 解析聊天文本。
     *
     * 优先走 Dify 抽取器；只有在没有抽到结构化结果时，才退回本地规则解析。
     */
    private ParsedInteraction parseMessage(Long userId, LocalDate focusDate, String message, UserTimeContext userTimeContext) {
        UserProfile profile = userProfileRepository.findByUserId(userId).orElse(null);
        InteractionDayState state = dayStateStore.computeIfAbsent(dayKey(userId, focusDate), ignored -> new InteractionDayState());
        DifyRecordExtractorClient.ExtractorContext extractorContext = buildExtractorContext(userId, focusDate, state, userTimeContext, profile);

        return difyRecordExtractorClient.extract(userId, message, profile, extractorContext)
                .filter(DifyRecordExtractorClient.RecordExtractionResult::hasStructuredData)
                .map(ParsedInteraction::fromExtractorResult)
                .orElseGet(() -> InteractionTextSupport.parseMessageLocally(message));
    }

    /**
     * 构造发给 Dify 抽取器的上下文。
     *
     * 这里会把当前已知血糖、预测状态和来源标签一起带上，方便模型做连续推断。
     */
    private DifyRecordExtractorClient.ExtractorContext buildExtractorContext(
            Long userId,
            LocalDate focusDate,
            InteractionDayState state,
            UserTimeContext userTimeContext,
            UserProfile profile
    ) {
        ActiveGlucoseForecastContext activeForecastContext = resolveActiveGlucoseForecastContext(state, userTimeContext);
        CurrentGlucoseContext predictionBaselineContext = resolvePredictionBaselineGlucoseContext(
                userId,
                focusDate,
                state,
                activeForecastContext,
                profile
        );
        return new DifyRecordExtractorClient.ExtractorContext(
                userTimeContext.timeZone(),
                userTimeContext.currentDate(),
                userTimeContext.currentTime(),
                userTimeContext.currentDateTime(),
                userTimeContext.utcOffset(),
                predictionBaselineContext.glucoseMmol(),
                predictionBaselineContext.source(),
                DEFAULT_GLUCOSE,
                predictionBaselineContext.glucoseMmol(),
                predictionBaselineContext.source(),
                activeForecastContext.currentGlucoseMmol(),
                activeForecastContext.currentHourOffset(),
                activeForecastContext.valid(),
                activeForecastContext.startedAt(),
                activeForecastContext.expiresAt(),
                state.glucoseRiskLevel(),
                state.calibrationApplied(),
                state.peakGlucoseMmol(),
                state.peakHourOffset(),
                state.returnToBaselineHourOffset(),
                state.glucoseForecast8h(),
                state.forecastSource()
        );
    }

    private CurrentGlucoseContext resolvePredictionBaselineGlucoseContext(
            Long userId,
            LocalDate focusDate,
            InteractionDayState state,
            ActiveGlucoseForecastContext activeForecastContext,
            UserProfile profile
    ) {
        if (Boolean.TRUE.equals(activeForecastContext.valid()) && activeForecastContext.currentGlucoseMmol() != null) {
            return new CurrentGlucoseContext(activeForecastContext.currentGlucoseMmol(), "active_forecast_current");
        }

        if (state.glucoseMmol() != null) {
            return new CurrentGlucoseContext(state.glucoseMmol(), "dialog_reported");
        }

        Double recordedGlucose = careRecordRepository
                .findByUserIdAndRecordedOnBetweenOrderByRecordedOnDescCreatedAtDesc(userId, focusDate, focusDate)
                .stream()
                .map(CareRecord::getGlucoseMmol)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
        if (recordedGlucose != null) {
            return new CurrentGlucoseContext(recordedGlucose, "care_record");
        }

        Double profileBaselineGlucose = resolveProfileBaselineGlucose(profile);
        if (profileBaselineGlucose != null) {
            return new CurrentGlucoseContext(profileBaselineGlucose, "profile_fasting_baseline");
        }

        return new CurrentGlucoseContext(DEFAULT_GLUCOSE, "default_baseline");
    }

    private Double resolveProfileBaselineGlucose(UserProfile profile) {
        if (profile == null || !StringUtils.hasText(profile.getFastingGlucoseBaseline())) {
            return null;
        }

        String baseline = profile.getFastingGlucoseBaseline().trim();
        Matcher matcher = GLUCOSE_NUMBER_PATTERN.matcher(baseline);
        if (!matcher.find()) {
            return null;
        }

        try {
            double parsed = Double.parseDouble(matcher.group(1));
            String normalized = baseline.toLowerCase(Locale.ROOT);
            if (normalized.contains("mg") || parsed > 30d) {
                parsed = parsed / 18d;
            }
            if (parsed < 2.5d || parsed > 25d) {
                return null;
            }
            return roundOneDecimal(parsed);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private ActiveGlucoseForecastContext resolveActiveGlucoseForecastContext(
            InteractionDayState state,
            UserTimeContext userTimeContext
    ) {
        if (state.forecastGeneratedAt() == null || state.glucoseForecast8h().isEmpty()) {
            return ActiveGlucoseForecastContext.empty();
        }

        String startedAt = formatInstantForUser(state.forecastGeneratedAt(), userTimeContext);
        String expiresAt = formatInstantForUser(state.forecastGeneratedAt().plus(Duration.ofHours(8)), userTimeContext);
        double elapsedHours = Duration.between(state.forecastGeneratedAt(), userTimeContext.currentInstant()).toMillis() / 3_600_000d;

        if (elapsedHours < -0.05d || elapsedHours > 8d) {
            return new ActiveGlucoseForecastContext(null, null, false, startedAt, expiresAt);
        }

        double currentHourOffset = clampDouble(elapsedHours, 0d, 8d);
        Double currentGlucose = interpolateForecastGlucoseAt(state.glucoseForecast8h(), currentHourOffset);
        return new ActiveGlucoseForecastContext(
                currentGlucose == null ? null : roundOneDecimal(currentGlucose),
                roundTwoDecimal(currentHourOffset),
                currentGlucose != null,
                startedAt,
                expiresAt
        );
    }

    private Double interpolateForecastGlucoseAt(
            List<DifyRecordExtractorClient.GlucoseForecastPoint> forecast,
            double hourOffset
    ) {
        List<DifyRecordExtractorClient.GlucoseForecastPoint> points = forecast.stream()
                .filter(point -> point.hourOffset() != null && point.predictedGlucoseMmol() != null)
                .sorted((left, right) -> left.hourOffset().compareTo(right.hourOffset()))
                .toList();
        if (points.isEmpty()) {
            return null;
        }

        DifyRecordExtractorClient.GlucoseForecastPoint previous = null;
        for (DifyRecordExtractorClient.GlucoseForecastPoint point : points) {
            double pointOffset = point.hourOffset();
            if (Math.abs(pointOffset - hourOffset) < 0.0001d) {
                return point.predictedGlucoseMmol();
            }
            if (pointOffset > hourOffset) {
                if (previous == null) {
                    return point.predictedGlucoseMmol();
                }
                double previousOffset = previous.hourOffset();
                double offsetRange = pointOffset - previousOffset;
                if (Math.abs(offsetRange) < 0.0001d) {
                    return point.predictedGlucoseMmol();
                }
                double ratio = (hourOffset - previousOffset) / offsetRange;
                return previous.predictedGlucoseMmol()
                        + (point.predictedGlucoseMmol() - previous.predictedGlucoseMmol()) * ratio;
            }
            previous = point;
        }

        return previous.predictedGlucoseMmol();
    }

    private Double resolveForecastAnchorGlucose(InteractionDayState state) {
        if (state.forecastAnchorGlucoseMmol() != null) {
            return state.forecastAnchorGlucoseMmol();
        }
        if (state.glucoseForecast8h().isEmpty()) {
            return null;
        }

        return state.glucoseForecast8h().stream()
                .filter(point -> point.hourOffset() != null && point.hourOffset() == 0)
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::predictedGlucoseMmol)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(state.glucoseForecast8h().get(0).predictedGlucoseMmol());
    }

    private AdjustmentModel resolveAdjustment(
            double glucose,
            int steps,
            double sleepHours,
            int calorieGap,
            DailyAdviceResponse advice,
            String feedback,
            InteractionDayState dayState
    ) {
        String title = calorieGap > 0 ? "压缩碳水负荷" : "补齐活动窗口";
        String parameterLabel = calorieGap > 0 ? "CHO" : "ACT";
        String parameterDelta = calorieGap > 0 ? "-" + clampToFive(calorieGap / 30, 5, 25) + " g" : "+10 min";
        String rationale = "基于今日总摄入、活动量与对话归档综合推演。";
        String observation = advice.adviceText();
        boolean forecastSuggestsHighRisk =
                isHighRisk(dayState.glucoseRiskLevel())
                        || (dayState.peakGlucoseMmol() != null && dayState.peakGlucoseMmol() >= 9.0);

        if (forecastSuggestsHighRisk || glucose >= 8) {
            title = "抑制餐后波动";
            parameterLabel = "CHO";
            parameterDelta = "-18 g";
            rationale = "对话中识别到较高血糖风险，优先压缩餐后波动。";
            observation = buildForecastObservation(dayState, "系统判定当前主要风险来自餐后峰值，应优先调整主食负荷并补上餐后轻步行。");
        } else if (steps < 5000) {
            title = "补齐活动量";
            parameterLabel = "ACT";
            parameterDelta = "+12 min";
            rationale = "步数仍处于低位，先把低强度活动拉回稳定区间。";
            observation = buildForecastObservation(dayState, "系统判定当前主要风险来自久坐与低活动量。");
        } else if (sleepHours < 6.5) {
            title = "修复恢复窗口";
            parameterLabel = "SLEEP";
            parameterDelta = "+0.5 h";
            rationale = "睡眠恢复不足时，额外加练的收益不如先补足恢复。";
            observation = buildForecastObservation(dayState, "系统判定当前主要风险来自恢复窗口不足。");
        } else {
            observation = buildForecastObservation(dayState, observation);
        }

        if (dayState.peakGlucoseMmol() != null && dayState.peakHourOffset() != null) {
            rationale = rationale + " 预测在 %s 达到 %s mmol/L 峰值。"
                    .formatted(formatHourOffset(dayState.peakHourOffset()), formatDecimal(dayState.peakGlucoseMmol()));
        }

        if (Boolean.TRUE.equals(dayState.calibrationApplied())) {
            rationale = rationale + " 已按最新实测血糖完成校准。";
        }

        if ("reject".equals(feedback)) {
            rationale = rationale + " 已收到“不太合适”反馈，等待下一轮后端校准。";
        } else if ("accept".equals(feedback)) {
            rationale = rationale + " 已收到“认可”反馈，将继续按此方向微调。";
        }

        return new AdjustmentModel(title, parameterLabel, parameterDelta, rationale, observation);
    }

    private double resolveDashboardGlucose(InteractionDayState dayState, Double recordedGlucose) {
        if (dayState.glucoseMmol() != null) {
            return dayState.glucoseMmol();
        }
        if (recordedGlucose != null) {
            return recordedGlucose;
        }
        if (dayState.forecastAnchorGlucoseMmol() != null) {
            return dayState.forecastAnchorGlucoseMmol();
        }
        return DEFAULT_GLUCOSE;
    }

    private double resolveDashboardGlucose(InteractionDayState dayState) {
        if (dayState.glucoseMmol() != null) {
            return dayState.glucoseMmol();
        }
        if (dayState.forecastAnchorGlucoseMmol() != null) {
            return dayState.forecastAnchorGlucoseMmol();
        }
        return DEFAULT_GLUCOSE;
    }

    private String resolveGlucoseMetricDescriptor(InteractionDayState dayState, Double recordedGlucose) {
        if (recordedGlucose != null) {
            return "今日实测血糖";
        }
        if (dayState.glucoseMmol() != null) {
            return "今日实测血糖";
        }
        if (!dayState.glucoseForecast8h().isEmpty()) {
            return "local".equals(dayState.forecastSource()) ? "本地 8 小时预测起点" : "Dify 8 小时预测起点";
        }
        return "暂无实时回传，先展示默认基线";
    }

    private String resolveGlucoseMetricSource(InteractionDayState dayState, Double recordedGlucose) {
        if (recordedGlucose != null) {
            return "后端归档";
        }
        if (dayState.glucoseMmol() != null) {
            return "对话解析";
        }
        if (!dayState.glucoseForecast8h().isEmpty()) {
            return "local".equals(dayState.forecastSource()) ? "规则模拟" : "Dify 工作流";
        }
        return "默认基线";
    }

    private int resolveDashboardSteps(InteractionDayState dayState, DailySummaryPoint point, Integer totalExerciseMinutes) {
        int persistedSteps = point != null ? safeInt(point.steps()) : 0;

        if (dayState.steps() != null) {
            return Math.max(dayState.steps(), persistedSteps);
        }
        return persistedSteps;
    }

    private String resolveDashboardStepMetricSource(InteractionDayState dayState, DailySummaryPoint point, Integer totalExerciseMinutes) {
        int persistedSteps = point != null ? safeInt(point.steps()) : 0;

        if (dayState.steps() != null && dayState.steps() > persistedSteps) {
            return "对话解析";
        }
        if (point != null && StringUtils.hasText(point.stepsSource())) {
            return persistedSteps > 0 ? point.stepsSource() : DEVICE_STEP_COUNTER_PENDING_SOURCE;
        }
        if (persistedSteps > 0) {
            return "设备传感器";
        }
        return "连接设备步数后自动同步";
    }

    private int resolveHistorySteps(DailySummaryPoint point, boolean focusPoint, InteractionDayState dayState) {
        int persistedSteps = safeInt(point.steps());

        if (focusPoint && dayState.steps() != null) {
            return Math.max(dayState.steps(), persistedSteps);
        }
        return persistedSteps;
    }

    private String resolveHistoryStepSource(DailySummaryPoint point, boolean focusPoint, InteractionDayState dayState) {
        int persistedSteps = safeInt(point.steps());

        if (focusPoint && dayState.steps() != null && dayState.steps() > persistedSteps) {
            return "对话解析";
        }
        if (StringUtils.hasText(point.stepsSource())) {
            return persistedSteps > 0 ? point.stepsSource() : DEVICE_STEP_COUNTER_PENDING_SOURCE;
        }
        if (persistedSteps > 0) {
            return "设备传感器";
        }
        return "连接设备步数后自动同步";
    }

    private boolean isHighRisk(String riskLevel) {
        if (!StringUtils.hasText(riskLevel)) {
            return false;
        }
        String normalized = riskLevel.trim().toLowerCase(Locale.ROOT);
        return normalized.contains("high") || normalized.contains("高");
    }

    private String buildForecastObservation(InteractionDayState dayState, String fallback) {
        List<String> fragments = new ArrayList<>();

        if (StringUtils.hasText(dayState.glucoseRiskLevel())) {
            fragments.add("血糖预测风险等级：" + dayState.glucoseRiskLevel());
        }
        if (dayState.peakGlucoseMmol() != null) {
            String peakText = "预计峰值 " + formatDecimal(dayState.peakGlucoseMmol()) + " mmol/L";
            if (dayState.peakHourOffset() != null) {
                peakText = peakText + "（" + formatHourOffset(dayState.peakHourOffset()) + "）";
            }
            fragments.add(peakText);
        }
        if (dayState.returnToBaselineHourOffset() != null) {
            fragments.add("约 " + formatHourOffset(dayState.returnToBaselineHourOffset()) + " 回落到基线");
        }
        if (Boolean.TRUE.equals(dayState.calibrationApplied())) {
            fragments.add("已结合最新实测血糖校准");
        }

        if (fragments.isEmpty()) {
            return fallback;
        }

        return String.join("，", fragments) + "。";
    }

    private ForecastComputation buildFallbackForecast(
            ParsedInteraction parsed,
            InteractionDayState state,
            String message,
            UserTimeContext userTimeContext,
            UserProfile profile
    ) {
        boolean hasMealSignal = parsed.calories() != null
                || StringUtils.hasText(parsed.foodName())
                || containsAny(message, "早餐", "早饭", "午餐", "午饭", "晚餐", "晚饭", "加餐", "零食", "米饭", "面", "面包", "水果", "香蕉", "奶茶", "可乐", "蛋糕", "凉皮", "粥");
        boolean hasOnlyCalibrationSignal = parsed.glucoseMmol() != null && !hasMealSignal && !state.glucoseForecast8h().isEmpty();

        if (hasOnlyCalibrationSignal) {
            return recalibrateForecast(state.glucoseForecast8h(), parsed.glucoseMmol());
        }

        if (!hasMealSignal && parsed.glucoseMmol() == null) {
            return null;
        }

        ActiveGlucoseForecastContext activeForecastContext = resolveActiveGlucoseForecastContext(state, userTimeContext);
        Double profileBaselineGlucose = resolveProfileBaselineGlucose(profile);
        double fallbackBaselineGlucose = profileBaselineGlucose != null ? profileBaselineGlucose : DEFAULT_GLUCOSE;
        double anchorGlucose = parsed.glucoseMmol() != null
                ? parsed.glucoseMmol()
                : Boolean.TRUE.equals(activeForecastContext.valid()) && activeForecastContext.currentGlucoseMmol() != null
                        ? activeForecastContext.currentGlucoseMmol()
                        : state.glucoseMmol() != null ? state.glucoseMmol() : fallbackBaselineGlucose;
        int calories = parsed.calories() != null ? parsed.calories() : estimateCaloriesFromFood(message);
        int steps = parsed.steps() != null ? parsed.steps() : state.steps() != null ? state.steps() : 0;
        int exerciseMinutes = parsed.exerciseMinutes() != null ? parsed.exerciseMinutes() : 0;
        double mealImpact = estimateMealImpact(message, calories);
        double activityRelief = Math.min(0.9d, (steps / 8000d) * 0.45d + (exerciseMinutes / 40d) * 0.25d);
        double peakRise = clampDouble(mealImpact - activityRelief, 0.35d, 2.8d);
        double peakGlucose = clampDouble(anchorGlucose + peakRise, 4.8d, 13.5d);
        double peakHourOffset = containsAny(message, "奶茶", "可乐", "蛋糕", "甜点", "果汁") ? 1d : 2d;
        double returnToBaselineHourOffset = clampDouble(4.5d + (calories / 300d) - activityRelief * 2.2d, 4d, 8d);
        double terminalValue = clampDouble(Math.max(fallbackBaselineGlucose, anchorGlucose - 0.2d), 4.8d, 9.5d);

        List<DifyRecordExtractorClient.GlucoseForecastPoint> points = List.of(
                new DifyRecordExtractorClient.GlucoseForecastPoint(0, roundOneDecimal(anchorGlucose), parsed.glucoseMmol() != null ? "measured_anchor" : "forecast"),
                new DifyRecordExtractorClient.GlucoseForecastPoint(1, roundOneDecimal(anchorGlucose + peakRise * (peakHourOffset <= 1d ? 1d : 0.65d)), "forecast"),
                new DifyRecordExtractorClient.GlucoseForecastPoint(2, roundOneDecimal(peakHourOffset <= 1d ? peakGlucose - peakRise * 0.12d : peakGlucose), "forecast"),
                new DifyRecordExtractorClient.GlucoseForecastPoint(3, roundOneDecimal(peakGlucose - peakRise * 0.22d), "forecast"),
                new DifyRecordExtractorClient.GlucoseForecastPoint(4, roundOneDecimal(peakGlucose - peakRise * 0.45d), "forecast"),
                new DifyRecordExtractorClient.GlucoseForecastPoint(6, roundOneDecimal(Math.max(terminalValue + 0.2d, peakGlucose - peakRise * 0.78d)), "forecast"),
                new DifyRecordExtractorClient.GlucoseForecastPoint(8, roundOneDecimal(terminalValue), "forecast")
        );

        return new ForecastComputation(
                classifyRiskLevel(peakGlucose),
                parsed.glucoseMmol() != null,
                roundOneDecimal(peakGlucose),
                peakHourOffset,
                roundOneDecimal(returnToBaselineHourOffset),
                points,
                roundOneDecimal(anchorGlucose)
        );
    }

    private ForecastComputation recalibrateForecast(
            List<DifyRecordExtractorClient.GlucoseForecastPoint> existingForecast,
            double measuredGlucose
    ) {
        if (existingForecast == null || existingForecast.isEmpty()) {
            return null;
        }

        double currentAnchor = existingForecast.stream()
                .filter(point -> point.hourOffset() != null && point.hourOffset() == 0)
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::predictedGlucoseMmol)
                .findFirst()
                .orElse(existingForecast.get(0).predictedGlucoseMmol());
        double delta = measuredGlucose - currentAnchor;

        List<DifyRecordExtractorClient.GlucoseForecastPoint> adjustedPoints = existingForecast.stream()
                .map(point -> {
                    double influence = 1d - Math.min(Math.max(point.hourOffset(), 0), 8) / 8d * 0.35d;
                    double adjustedValue = clampDouble(point.predictedGlucoseMmol() + delta * influence, 4.8d, 13.5d);
                    String pointType = point.hourOffset() != null && point.hourOffset() == 0 ? "measured_anchor" : point.pointType();
                    return new DifyRecordExtractorClient.GlucoseForecastPoint(point.hourOffset(), roundOneDecimal(adjustedValue), pointType);
                })
                .toList();

        double peakGlucose = adjustedPoints.stream()
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::predictedGlucoseMmol)
                .max(Double::compareTo)
                .orElse(measuredGlucose);
        double peakHourOffset = adjustedPoints.stream()
                .filter(point -> Objects.equals(point.predictedGlucoseMmol(), peakGlucose))
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::hourOffset)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(2);

        return new ForecastComputation(
                classifyRiskLevel(peakGlucose),
                true,
                roundOneDecimal(peakGlucose),
                Double.valueOf(peakHourOffset),
                6d,
                adjustedPoints,
                roundOneDecimal(measuredGlucose)
        );
    }

    private void applyForecastToState(InteractionDayState state, ForecastComputation forecast, String source) {
        if (forecast == null) {
            return;
        }

        List<DifyRecordExtractorClient.GlucoseForecastPoint> normalizedForecast = normalizeForecastPoints(
                forecast.glucoseForecast8h(),
                forecast.forecastAnchorGlucoseMmol()
        );
        Double normalizedPeakGlucose = resolvePeakGlucose(normalizedForecast, forecast.peakGlucoseMmol());

        state.setGlucoseRiskLevel(forecast.glucoseRiskLevel());
        state.setCalibrationApplied(forecast.calibrationApplied());
        state.setPeakGlucoseMmol(normalizedPeakGlucose);
        state.setPeakHourOffset(resolvePeakHourOffset(normalizedForecast, normalizedPeakGlucose, forecast.peakHourOffset()));
        state.setReturnToBaselineHourOffset(forecast.returnToBaselineHourOffset());
        state.setGlucoseForecast8h(normalizedForecast);
        state.setForecastAnchorGlucoseMmol(resolveForecastAnchorGlucose(normalizedForecast, forecast.forecastAnchorGlucoseMmol()));
        state.setForecastSource(source);
        state.setForecastGeneratedAt(Instant.now());
    }

    private List<DifyRecordExtractorClient.GlucoseForecastPoint> normalizeForecastPoints(
            List<DifyRecordExtractorClient.GlucoseForecastPoint> forecastPoints,
            Double forecastAnchorGlucoseMmol
    ) {
        if (forecastPoints == null || forecastPoints.isEmpty()) {
            return List.of();
        }

        List<DifyRecordExtractorClient.GlucoseForecastPoint> validPoints = forecastPoints.stream()
                .filter(point -> point.hourOffset() != null
                        && point.predictedGlucoseMmol() != null
                        && point.hourOffset() >= 0
                        && point.hourOffset() <= 8)
                .sorted((left, right) -> left.hourOffset().compareTo(right.hourOffset()))
                .toList();
        if (validPoints.isEmpty()) {
            return List.of();
        }

        Double anchorGlucose = forecastAnchorGlucoseMmol != null
                ? forecastAnchorGlucoseMmol
                : validPoints.stream()
                        .filter(point -> point.hourOffset() != null && point.hourOffset() == 0)
                        .map(DifyRecordExtractorClient.GlucoseForecastPoint::predictedGlucoseMmol)
                        .findFirst()
                        .orElse(validPoints.get(0).predictedGlucoseMmol());

        List<DifyRecordExtractorClient.GlucoseForecastPoint> normalizedPoints = new ArrayList<>();
        for (Integer requiredOffset : REQUIRED_FORECAST_HOUR_OFFSETS) {
            DifyRecordExtractorClient.GlucoseForecastPoint existingPoint = validPoints.stream()
                    .filter(point -> Objects.equals(point.hourOffset(), requiredOffset))
                    .findFirst()
                    .orElse(null);
            if (existingPoint != null) {
                normalizedPoints.add(existingPoint);
                continue;
            }

            Double predictedGlucose = estimateForecastGlucoseAt(validPoints, requiredOffset, anchorGlucose);
            if (predictedGlucose != null) {
                normalizedPoints.add(new DifyRecordExtractorClient.GlucoseForecastPoint(
                        requiredOffset,
                        roundOneDecimal(predictedGlucose),
                        "forecast"
                ));
            }
        }

        return List.copyOf(normalizedPoints);
    }

    private Double estimateForecastGlucoseAt(
            List<DifyRecordExtractorClient.GlucoseForecastPoint> points,
            int hourOffset,
            Double anchorGlucose
    ) {
        DifyRecordExtractorClient.GlucoseForecastPoint previous = null;
        for (DifyRecordExtractorClient.GlucoseForecastPoint point : points) {
            if (Objects.equals(point.hourOffset(), hourOffset)) {
                return point.predictedGlucoseMmol();
            }

            if (point.hourOffset() > hourOffset) {
                if (previous == null) {
                    return point.predictedGlucoseMmol();
                }

                double previousOffset = previous.hourOffset();
                double offsetRange = point.hourOffset() - previousOffset;
                if (Math.abs(offsetRange) < 0.0001d) {
                    return point.predictedGlucoseMmol();
                }

                double ratio = (hourOffset - previousOffset) / offsetRange;
                return previous.predictedGlucoseMmol()
                        + (point.predictedGlucoseMmol() - previous.predictedGlucoseMmol()) * ratio;
            }

            previous = point;
        }

        if (previous == null) {
            return null;
        }
        if (anchorGlucose == null || hourOffset <= previous.hourOffset()) {
            return previous.predictedGlucoseMmol();
        }

        double remainingWindow = Math.max(1d, 8d - previous.hourOffset());
        double ratioTowardBaseline = Math.min(1d, (hourOffset - previous.hourOffset()) / remainingWindow);
        return previous.predictedGlucoseMmol()
                + (anchorGlucose - previous.predictedGlucoseMmol()) * ratioTowardBaseline * 0.6d;
    }

    private Double resolvePeakGlucose(
            List<DifyRecordExtractorClient.GlucoseForecastPoint> forecastPoints,
            Double fallbackPeakGlucose
    ) {
        if (forecastPoints == null || forecastPoints.isEmpty()) {
            return fallbackPeakGlucose;
        }

        return forecastPoints.stream()
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::predictedGlucoseMmol)
                .filter(Objects::nonNull)
                .max(Double::compareTo)
                .map(this::roundOneDecimal)
                .orElse(fallbackPeakGlucose);
    }

    private Double resolvePeakHourOffset(
            List<DifyRecordExtractorClient.GlucoseForecastPoint> forecastPoints,
            Double peakGlucose,
            Double fallbackPeakHourOffset
    ) {
        if (forecastPoints == null || forecastPoints.isEmpty() || peakGlucose == null) {
            return fallbackPeakHourOffset;
        }

        return forecastPoints.stream()
                .filter(point -> point.predictedGlucoseMmol() != null
                        && Math.abs(point.predictedGlucoseMmol() - peakGlucose) < 0.0001d)
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::hourOffset)
                .filter(Objects::nonNull)
                .map(Integer::doubleValue)
                .findFirst()
                .orElse(fallbackPeakHourOffset);
    }

    private Double resolveForecastAnchorGlucose(
            List<DifyRecordExtractorClient.GlucoseForecastPoint> forecastPoints,
            Double fallbackAnchorGlucose
    ) {
        if (forecastPoints == null || forecastPoints.isEmpty()) {
            return fallbackAnchorGlucose;
        }

        return forecastPoints.stream()
                .filter(point -> point.hourOffset() != null && point.hourOffset() == 0)
                .map(DifyRecordExtractorClient.GlucoseForecastPoint::predictedGlucoseMmol)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(fallbackAnchorGlucose);
    }

    private int estimateCaloriesFromFood(String message) {
        int estimate = 320;
        if (containsAny(message, "米饭", "面", "面包", "粥", "香蕉", "凉皮")) {
            estimate += 180;
        }
        if (containsAny(message, "奶茶", "可乐", "蛋糕", "甜点", "果汁")) {
            estimate += 220;
        }
        if (containsAny(message, "鸡胸肉", "鸡蛋", "豆腐", "蔬菜", "沙拉")) {
            estimate += 120;
        }
        return estimate;
    }

    private double estimateMealImpact(String message, int calories) {
        double baseImpact = 0.75d + Math.min(calories, 900) / 300d * 0.35d;
        if (containsAny(message, "米饭", "面", "面包", "粥", "香蕉", "水果", "凉皮")) {
            baseImpact += 0.35d;
        }
        if (containsAny(message, "奶茶", "可乐", "蛋糕", "甜点", "果汁")) {
            baseImpact += 0.55d;
        }
        if (containsAny(message, "鸡胸肉", "蔬菜", "沙拉", "鸡蛋", "豆腐")) {
            baseImpact -= 0.12d;
        }
        return baseImpact;
    }

    private String classifyRiskLevel(double peakGlucose) {
        if (peakGlucose >= 10d) {
            return "高";
        }
        if (peakGlucose >= 8.5d) {
            return "中";
        }
        return "低";
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10d) / 10d;
    }

    private double roundTwoDecimal(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private double clampDouble(double value, double min, double max) {
        if (Double.isNaN(value)) {
            return min;
        }
        return Math.max(min, Math.min(max, value));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private ChatMessageResponse newMessage(String role, String content) {
        return new ChatMessageResponse(role + "-" + UUID.randomUUID(), role, content, LocalDateTime.now());
    }

    private UserTimeContext resolveUserTimeContext(String requestedTimeZone) {
        ZoneId zoneId = resolveZoneId(requestedTimeZone);
        Instant now = Instant.now();
        ZonedDateTime userNow = now.atZone(zoneId);
        return new UserTimeContext(
                now,
                zoneId.getId(),
                userNow.toLocalDate().toString(),
                userNow.toLocalTime().withNano(0).toString(),
                userNow.withNano(0).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                userNow.getOffset().getId()
        );
    }

    private ZoneId resolveZoneId(String requestedTimeZone) {
        if (StringUtils.hasText(requestedTimeZone)) {
            try {
                return ZoneId.of(requestedTimeZone.trim());
            } catch (DateTimeException ignored) {
                // Fall through to the server default when the client sends an unknown zone id.
            }
        }

        return ZoneId.systemDefault();
    }

    private String formatInstantForUser(Instant instant, UserTimeContext userTimeContext) {
        return instant.atZone(resolveZoneId(userTimeContext.timeZone()))
                .withNano(0)
                .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    private LocalDate resolveDate(LocalDate date) {
        return date != null ? date : LocalDate.now();
    }

    private LocalDate resolveDate(LocalDate date, UserTimeContext userTimeContext) {
        return date != null ? date : LocalDate.parse(userTimeContext.currentDate());
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

    private boolean containsAny(String source, String... keywords) {
        for (String keyword : keywords) {
            if (source.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String formatDecimal(double value) {
        return String.format(Locale.US, "%.1f", value);
    }

    private String formatHourOffset(double hourOffset) {
        if (Math.abs(hourOffset - Math.rint(hourOffset)) < 0.05d) {
            return "+" + (int) Math.rint(hourOffset) + "h";
        }
        return "+" + formatDecimal(hourOffset) + "h";
    }

    private int clampToFive(int multiplier, int min, int max) {
        int resolved = Math.max(min, Math.min(max, multiplier * 5));
        return Math.max(min, resolved);
    }

}
