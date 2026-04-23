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
        Integer calories = extractInt(message, "(\\d+)\\s*(?:kcal|千卡|卡路里|卡)\\b");
        Integer exerciseMinutes = containsAny(normalized, "走", "跑", "骑", "运动", "训练", "快走", "步行")
                ? extractInt(message, "(\\d+)\\s*(?:分钟|分|min)\\b")
                : null;
        Double glucose = extractDouble(message, "血糖[^\\d]*(\\d+(?:\\.\\d+)?)");
        Double sleepHours = containsAny(message, "睡", "睡眠", "入睡")
                ? extractDouble(message, "(\\d+(?:\\.\\d+)?)\\s*(?:小时|h)\\b")
                : null;

        return new ParsedInteraction(calories, exerciseMinutes, steps, glucose, sleepHours, null, null, null, null, null, null, null, null, List.of(), null, null, null);
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

    private static String inferMealType(String message) {
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

    private static String inferFoodName(String message) {
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
