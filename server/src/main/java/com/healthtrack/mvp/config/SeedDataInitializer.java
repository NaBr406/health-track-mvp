package com.healthtrack.mvp.config;

import com.healthtrack.mvp.domain.AiAdviceLog;
import com.healthtrack.mvp.domain.CareRecord;
import com.healthtrack.mvp.domain.DietRecord;
import com.healthtrack.mvp.domain.ExerciseRecord;
import com.healthtrack.mvp.domain.User;
import com.healthtrack.mvp.domain.UserProfile;
import com.healthtrack.mvp.repository.AiAdviceLogRepository;
import com.healthtrack.mvp.repository.CareRecordRepository;
import com.healthtrack.mvp.repository.DietRecordRepository;
import com.healthtrack.mvp.repository.ExerciseRecordRepository;
import com.healthtrack.mvp.repository.UserProfileRepository;
import com.healthtrack.mvp.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 在项目首次启动时灌入演示账号和基础记录，方便 MVP 直接体验。
 */
@Component
@RequiredArgsConstructor
public class SeedDataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final DietRecordRepository dietRecordRepository;
    private final ExerciseRecordRepository exerciseRecordRepository;
    private final CareRecordRepository careRecordRepository;
    private final AiAdviceLogRepository aiAdviceLogRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.enabled:true}")
    private boolean seedEnabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!seedEnabled || userRepository.count() > 0) {
            return;
        }

        User demoUser = new User();
        demoUser.setEmail("demo@healthtrack.local");
        demoUser.setPassword(passwordEncoder.encode("Demo123456!"));
        demoUser.setNickname("Demo User");
        demoUser = userRepository.save(demoUser);

        UserProfile profile = new UserProfile();
        profile.setUser(demoUser);
        profile.setAge(28);
        profile.setGender("female");
        profile.setHeightCm(new BigDecimal("165"));
        profile.setWeightKg(new BigDecimal("58.5"));
        profile.setTargetWeightKg(new BigDecimal("55.0"));
        profile.setDailyCalorieGoal(1800);
        profile.setWeeklyExerciseGoalMinutes(180);
        profile.setConditionLabel("type-2-diabetes");
        profile.setFastingGlucoseBaseline("7.2 mmol/L");
        profile.setBloodPressureBaseline("128/82 mmHg");
        profile.setRestingHeartRate(74);
        profile.setMedicationPlan("metformin 0.5g bid");
        profile.setNotes("High-GI meals need extra postprandial monitoring.");
        profile.setCareFocus("睡眠与基础皮肤护理");
        profile.setHealthGoal("减脂并提升精力状态");
        userProfileRepository.save(profile);

        DietRecord breakfast = new DietRecord();
        breakfast.setUser(demoUser);
        breakfast.setRecordedOn(LocalDate.now());
        breakfast.setMealType("早餐");
        breakfast.setFoodName("燕麦酸奶水果碗");
        breakfast.setCalories(420);
        breakfast.setProteinGrams(new BigDecimal("18"));
        breakfast.setCarbsGrams(new BigDecimal("52"));
        breakfast.setFatGrams(new BigDecimal("12"));
        breakfast.setNote("高纤维、高饱腹感");
        dietRecordRepository.save(breakfast);

        DietRecord lunch = new DietRecord();
        lunch.setUser(demoUser);
        lunch.setRecordedOn(LocalDate.now().minusDays(1));
        lunch.setMealType("午餐");
        lunch.setFoodName("鸡胸肉藜麦沙拉");
        lunch.setCalories(560);
        lunch.setProteinGrams(new BigDecimal("34"));
        lunch.setCarbsGrams(new BigDecimal("48"));
        lunch.setFatGrams(new BigDecimal("17"));
        lunch.setNote("控制油脂摄入");
        dietRecordRepository.save(lunch);

        ExerciseRecord exercise = new ExerciseRecord();
        exercise.setUser(demoUser);
        exercise.setRecordedOn(LocalDate.now());
        exercise.setActivityName("快走 + 拉伸");
        exercise.setDurationMinutes(45);
        exercise.setCaloriesBurned(280);
        exercise.setIntensity("中等");
        exercise.setNote("下班后完成");
        exerciseRecordRepository.save(exercise);

        ExerciseRecord yoga = new ExerciseRecord();
        yoga.setUser(demoUser);
        yoga.setRecordedOn(LocalDate.now().minusDays(2));
        yoga.setActivityName("瑜伽");
        yoga.setDurationMinutes(35);
        yoga.setCaloriesBurned(120);
        yoga.setIntensity("低");
        exerciseRecordRepository.save(yoga);

        CareRecord care = new CareRecord();
        care.setUser(demoUser);
        care.setRecordedOn(LocalDate.now());
        care.setCategory("护肤");
        care.setItemName("晚间护肤");
        care.setDurationMinutes(15);
        care.setStatus("completed");
        care.setNote("完成清洁、保湿与修护");
        careRecordRepository.save(care);

        AiAdviceLog adviceLog = new AiAdviceLog();
        adviceLog.setUser(demoUser);
        adviceLog.setAdviceDate(LocalDate.now());
        adviceLog.setRequestPayload("{\"seed\":true}");
        adviceLog.setResponsePayload("{\"source\":\"seed\"}");
        adviceLog.setAdviceText("今日建议：维持早餐高蛋白结构，晚间补 10 分钟拉伸，并保持睡前护理流程。");
        adviceLog.setSource("seed");
        adviceLog.setStatus("SUCCESS");
        aiAdviceLogRepository.save(adviceLog);
    }
}

