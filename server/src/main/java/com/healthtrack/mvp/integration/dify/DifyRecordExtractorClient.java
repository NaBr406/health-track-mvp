package com.healthtrack.mvp.integration.dify;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthtrack.mvp.domain.UserProfile;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
@RequiredArgsConstructor
public class DifyRecordExtractorClient {

    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Value("${app.dify.extractor.base-url:}")
    private String baseUrl;

    @Value("${app.dify.extractor.api-key:}")
    private String apiKey;

    @Value("${app.dify.extractor.workflow-id:}")
    private String workflowId;

    @Value("${app.dify.extractor.input-variable:UserInput}")
    private String inputVariable;

    @Value("${app.dify.extractor.profile-input-variable:}")
    private String profileInputVariable;

    public Optional<RecordExtractionResult> extract(Long userId, String message, UserProfile profile) {
        if (!StringUtils.hasText(baseUrl) || !StringUtils.hasText(apiKey) || !StringUtils.hasText(message)) {
            return Optional.empty();
        }

        Map<String, Object> inputs = new LinkedHashMap<>();
        inputs.put(inputVariable, message);
        if (StringUtils.hasText(profileInputVariable)) {
            inputs.put(profileInputVariable, writeUserProfile(profile));
        }

        Optional<RecordExtractionResult> extraction = extractWithInputs(userId, inputs);
        if (extraction.isPresent()) {
            return extraction;
        }

        if (StringUtils.hasText(profileInputVariable)) {
            Map<String, Object> fallbackInputs = new LinkedHashMap<>();
            fallbackInputs.put(inputVariable, message);
            log.warn("Retrying Dify extractor without profile input variable '{}'", profileInputVariable);
            return extractWithInputs(userId, fallbackInputs);
        }

        return Optional.empty();
    }

    private Optional<RecordExtractionResult> extractWithInputs(Long userId, Map<String, Object> inputs) {
        if (!StringUtils.hasText(baseUrl) || !StringUtils.hasText(apiKey)) {
            return Optional.empty();
        }

        String normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String endpoint = StringUtils.hasText(workflowId)
                ? normalizedBaseUrl + "/v1/workflows/" + workflowId + "/run"
                : normalizedBaseUrl + "/v1/workflows/run";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("inputs", inputs);
        payload.put("response_mode", "blocking");
        payload.put("user", "health-track-" + userId);

        try {
            JsonNode response = restClient.post()
                    .uri(endpoint)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);

            JsonNode outputNode = resolveOutputNode(response);
            if (outputNode == null || outputNode.isMissingNode() || outputNode.isNull() || !outputNode.isObject()) {
                log.warn("Dify extractor returned unmapped output shape: {}", response == null ? "{}" : response.toString());
                return Optional.empty();
            }

            RecordExtractionResult result = new RecordExtractionResult(
                    readBoolean(outputNode.get("isHealthRecord")),
                    readInteger(outputNode.get("calories")),
                    readInteger(outputNode.get("exerciseMinutes")),
                    readInteger(outputNode.get("steps")),
                    readDouble(outputNode.get("glucoseMmol")),
                    readDouble(outputNode.get("sleepHours")),
                    readString(outputNode.get("mealType")),
                    readString(outputNode.get("foodName")),
                    readString(outputNode.get("activityName")),
                    readString(outputNode.get("glucoseRiskLevel")),
                    readBoolean(outputNode.get("calibrationApplied")),
                    readDouble(outputNode.get("peakGlucoseMmol")),
                    readDouble(outputNode.get("peakHourOffset")),
                    readDouble(outputNode.get("returnToBaselineHourOffset")),
                    readGlucoseForecast(outputNode.get("glucoseForecast8h")),
                    readBoolean(outputNode.get("needsFollowup")),
                    readString(outputNode.get("followupQuestion")),
                    readDouble(outputNode.get("confidence")),
                    readString(outputNode.get("normalizedMessage")),
                    response == null ? "{}" : response.toString()
            );

            return Optional.of(result);
        } catch (Exception ex) {
            log.warn("Failed to call Dify record extractor: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private JsonNode resolveOutputNode(JsonNode root) {
        if (root == null || root.isNull()) {
            return null;
        }

        JsonNode structuredOutputNode = resolveObjectNode(root.at("/data/outputs/structured_output"));
        if (structuredOutputNode != null) {
            return structuredOutputNode;
        }

        JsonNode jsonNode = resolveObjectNode(root.at("/data/outputs/json"));
        if (jsonNode != null) {
            return jsonNode;
        }

        JsonNode textNode = resolveObjectNode(root.at("/data/outputs/text"));
        if (textNode != null) {
            return textNode;
        }

        JsonNode outputs = root.at("/data/outputs");
        if (!outputs.isObject()) {
            return null;
        }

        return outputs;
    }

    private JsonNode resolveObjectNode(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }

        if (node.isObject()) {
            return node;
        }

        if (node.isTextual()) {
            try {
                JsonNode parsedNode = objectMapper.readTree(node.asText());
                return parsedNode != null && parsedNode.isObject() ? parsedNode : null;
            } catch (JsonProcessingException ex) {
                return null;
            }
        }

        return null;
    }

    private Map<String, Object> writeUserProfile(UserProfile profile) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (profile != null) {
            payload.put("conditionLabel", profile.getConditionLabel());
            payload.put("fastingGlucoseBaseline", profile.getFastingGlucoseBaseline());
            payload.put("bloodPressureBaseline", profile.getBloodPressureBaseline());
            payload.put("restingHeartRate", profile.getRestingHeartRate());
            payload.put("medicationPlan", profile.getMedicationPlan());
            payload.put("notes", profile.getNotes());
            payload.put("age", profile.getAge());
            payload.put("gender", profile.getGender());
            payload.put("heightCm", toDouble(profile.getHeightCm()));
            payload.put("weightKg", toDouble(profile.getWeightKg()));
            payload.put("targetWeightKg", toDouble(profile.getTargetWeightKg()));
            payload.put("dailyCalorieGoal", profile.getDailyCalorieGoal());
            payload.put("weeklyExerciseGoalMinutes", profile.getWeeklyExerciseGoalMinutes());
            payload.put("careFocus", profile.getCareFocus());
            payload.put("healthGoal", profile.getHealthGoal());
        }
        return payload;
    }

    private Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private String readString(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }

        String value = node.asText(null);
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private Integer readInteger(JsonNode node) {
        String value = readString(node);
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            return Integer.valueOf((int) Math.round(Double.parseDouble(value)));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Double readDouble(JsonNode node) {
        String value = readString(node);
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            return Double.valueOf(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Boolean readBoolean(JsonNode node) {
        String value = readString(node);
        if (!StringUtils.hasText(value)) {
            return null;
        }

        if ("true".equalsIgnoreCase(value)) {
            return Boolean.TRUE;
        }
        if ("false".equalsIgnoreCase(value)) {
            return Boolean.FALSE;
        }

        return null;
    }

    private List<GlucoseForecastPoint> readGlucoseForecast(JsonNode node) {
        JsonNode arrayNode = node;
        if (arrayNode != null && arrayNode.isTextual()) {
            try {
                arrayNode = objectMapper.readTree(arrayNode.asText());
            } catch (JsonProcessingException ex) {
                return List.of();
            }
        }

        if (arrayNode == null || arrayNode.isNull() || !arrayNode.isArray()) {
            return List.of();
        }

        List<GlucoseForecastPoint> points = new ArrayList<>();
        for (JsonNode item : arrayNode) {
            Integer hourOffset = readInteger(item.get("hourOffset"));
            Double predictedGlucoseMmol = readDouble(item.get("predictedGlucoseMmol"));
            String pointType = readString(item.get("pointType"));

            if (hourOffset == null || predictedGlucoseMmol == null) {
                continue;
            }

            points.add(new GlucoseForecastPoint(hourOffset, predictedGlucoseMmol, pointType));
        }

        points.sort(Comparator.comparing(GlucoseForecastPoint::hourOffset));
        return List.copyOf(points);
    }

    public record RecordExtractionResult(
            Boolean isHealthRecord,
            Integer calories,
            Integer exerciseMinutes,
            Integer steps,
            Double glucoseMmol,
            Double sleepHours,
            String mealType,
            String foodName,
            String activityName,
            String glucoseRiskLevel,
            Boolean calibrationApplied,
            Double peakGlucoseMmol,
            Double peakHourOffset,
            Double returnToBaselineHourOffset,
            List<GlucoseForecastPoint> glucoseForecast8h,
            Boolean needsFollowup,
            String followupQuestion,
            Double confidence,
            String normalizedMessage,
            String rawResponse
    ) {
        public boolean hasStructuredData() {
            return Boolean.TRUE.equals(isHealthRecord)
                    || calories != null
                    || exerciseMinutes != null
                    || steps != null
                    || glucoseMmol != null
                    || sleepHours != null
                    || StringUtils.hasText(mealType)
                    || StringUtils.hasText(foodName)
                    || StringUtils.hasText(activityName)
                    || StringUtils.hasText(glucoseRiskLevel)
                    || calibrationApplied != null
                    || peakGlucoseMmol != null
                    || peakHourOffset != null
                    || returnToBaselineHourOffset != null
                    || (glucoseForecast8h != null && !glucoseForecast8h.isEmpty());
        }

        public Double forecastAnchorGlucoseMmol() {
            if (glucoseForecast8h == null || glucoseForecast8h.isEmpty()) {
                return null;
            }

            return glucoseForecast8h.stream()
                    .filter(point -> point.hourOffset() != null && point.hourOffset() == 0)
                    .map(GlucoseForecastPoint::predictedGlucoseMmol)
                    .findFirst()
                    .orElse(glucoseForecast8h.get(0).predictedGlucoseMmol());
        }
    }

    public record GlucoseForecastPoint(
            Integer hourOffset,
            Double predictedGlucoseMmol,
            String pointType
    ) {
    }
}
