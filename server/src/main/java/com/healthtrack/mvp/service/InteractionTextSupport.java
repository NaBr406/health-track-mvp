package com.healthtrack.mvp.service;

import java.util.List;
import java.util.Locale;
import org.springframework.util.StringUtils;

final class InteractionTextSupport {

    private InteractionTextSupport() {
    }

    static ParsedInteraction parseMessageLocally(String message) {
        String normalized = message.toLowerCase(Locale.ROOT);
        Integer steps = extractInt(message, "(\\d+)\\s*(?:步|steps?)");
        Integer explicitCalories = extractInt(message, "(\\d+)\\s*(?:kcal|千卡|卡路里|卡)\\b");
        boolean hasFoodSignal = hasFoodSignal(message);
        Integer calories = explicitCalories != null ? explicitCalories : hasFoodSignal ? estimateCalories(message) : null;
        Integer exerciseMinutes = containsAny(normalized, "走", "跑", "骑", "运动", "训练", "快走", "步行")
                ? extractInt(message, "(\\d+)\\s*(?:分钟|分|min)\\b")
                : null;
        Double glucose = extractDouble(message, "血糖[^\\d]*(\\d+(?:\\.\\d+)?)");
        Double sleepHours = containsAny(message, "睡", "睡眠", "入睡")
                ? extractDouble(message, "(\\d+(?:\\.\\d+)?)\\s*(?:小时|h)\\b")
                : null;

        return new ParsedInteraction(
                calories,
                exerciseMinutes,
                steps,
                glucose,
                sleepHours,
                hasFoodSignal ? inferMealType(message) : null,
                hasFoodSignal ? inferFoodName(message) : null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                null,
                null,
                null
        );
    }

    static String resolveMealType(ParsedInteraction parsed, String message) {
        return StringUtils.hasText(parsed.mealType()) ? parsed.mealType() : inferMealType(message);
    }

    static String resolveFoodName(ParsedInteraction parsed, String message) {
        return StringUtils.hasText(parsed.foodName()) ? parsed.foodName() : inferFoodName(message);
    }

    static String resolveActivityName(ParsedInteraction parsed, String message, Integer steps) {
        return StringUtils.hasText(parsed.activityName()) ? parsed.activityName() : inferActivityName(message, steps);
    }

    static String trimToLength(String value, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private static Integer extractInt(String source, String regex) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.CASE_INSENSITIVE).matcher(source);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : null;
    }

    private static Double extractDouble(String source, String regex) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.CASE_INSENSITIVE).matcher(source);
        return matcher.find() ? Double.parseDouble(matcher.group(1)) : null;
    }

    private static boolean containsAny(String source, String... keywords) {
        for (String keyword : keywords) {
            if (source.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasFoodSignal(String message) {
        return containsAny(
                message,
                "吃", "喝", "早餐", "早饭", "午餐", "午饭", "晚餐", "晚饭", "加餐", "零食",
                "米饭", "面", "面包", "粥", "凉皮", "凉面", "粉", "粉条", "水果", "香蕉", "苹果",
                "可乐", "奶茶", "果汁", "饮料", "蛋糕", "甜点", "鸡胸肉", "鸡蛋", "豆腐", "蔬菜", "沙拉"
        );
    }

    private static int estimateCalories(String message) {
        int estimate = 0;
        if (containsAny(message, "凉皮")) {
            estimate += 420;
        }
        if (containsAny(message, "可乐")) {
            estimate += 210;
        }
        if (containsAny(message, "奶茶")) {
            estimate += 360;
        }
        if (containsAny(message, "果汁", "饮料")) {
            estimate += 160;
        }
        if (containsAny(message, "米饭", "面", "面包", "粥", "粉", "粉条", "凉面")) {
            estimate += 320;
        }
        if (containsAny(message, "蛋糕", "甜点")) {
            estimate += 300;
        }
        if (containsAny(message, "水果", "香蕉", "苹果")) {
            estimate += 120;
        }
        if (containsAny(message, "鸡胸肉", "鸡蛋", "豆腐")) {
            estimate += 150;
        }
        if (containsAny(message, "蔬菜", "沙拉")) {
            estimate += 80;
        }

        return Math.max(estimate, 280);
    }

    private static String inferMealType(String message) {
        if (containsAny(message, "早餐", "早饭")) {
            return "早餐";
        }
        if (containsAny(message, "午餐", "午饭")) {
            return "午餐";
        }
        if (containsAny(message, "晚餐", "晚饭", "今晚", "晚上", "夜里")) {
            return "晚餐";
        }
        if (containsAny(message, "加餐", "零食")) {
            return "加餐";
        }
        return "对话记录";
    }

    private static String inferFoodName(String message) {
        if (containsAny(message, "凉皮") && containsAny(message, "可乐")) {
            return "凉皮、可乐";
        }
        if (containsAny(message, "凉皮")) {
            return "凉皮";
        }
        if (containsAny(message, "可乐")) {
            return containsAny(message, "凉皮") ? "凉皮、可乐" : "可乐";
        }
        if (containsAny(message, "奶茶")) {
            return "奶茶";
        }
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

    private static String inferActivityName(String message, Integer steps) {
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
}
