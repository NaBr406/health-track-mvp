package com.healthtrack.mvp.integration.dify;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.Iterator;
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
public class DifyClient {

    private static final List<String> DIRECT_TEXT_PATHS = List.of(
            "/data/outputs/text",
            "/data/outputs/advice",
            "/data/outputs/answer",
            "/data/outputs/content",
            "/data/output/text",
            "/answer"
    );

    private static final List<String> PREFERRED_FIELD_NAMES = List.of(
            "adviceText",
            "advice_text",
            "advice",
            "text",
            "answer",
            "content",
            "summary",
            "message",
            "finalAnswer",
            "final_answer"
    );

    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Value("${app.dify.base-url:}")
    private String baseUrl;

    @Value("${app.dify.api-key:}")
    private String apiKey;

    @Value("${app.dify.workflow-id:}")
    private String workflowId;

    @Value("${app.dify.input-variable:}")
    private String inputVariable;

    @Value("${app.dify.input-stringify:false}")
    private boolean inputStringify;

    public Optional<DifyAdviceResult> generateDailyAdvice(Long userId, LocalDate adviceDate, Map<String, Object> context) {
        if (!StringUtils.hasText(baseUrl) || !StringUtils.hasText(apiKey)) {
            return Optional.empty();
        }

        String normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String endpoint = StringUtils.hasText(workflowId)
                ? normalizedBaseUrl + "/v1/workflows/" + workflowId + "/run"
                : normalizedBaseUrl + "/v1/workflows/run";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("inputs", buildInputs(context));
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

            String adviceText = extractAdviceText(response);
            if (!StringUtils.hasText(adviceText)) {
                adviceText = "Dify returned a response, but no mapped advice field was found.";
            }

            return Optional.of(new DifyAdviceResult(adviceText, "dify", response == null ? "{}" : response.toString()));
        } catch (Exception ex) {
            log.warn("Failed to call Dify workflow: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private String extractAdviceText(JsonNode root) {
        if (root == null || root.isNull()) {
            return null;
        }

        for (String path : DIRECT_TEXT_PATHS) {
            String text = extractAdviceTextFromNode(root.at(path), 0);
            if (StringUtils.hasText(text)) {
                return text;
            }
        }

        String outputText = extractAdviceTextFromNode(root.at("/data/outputs"), 0);
        if (StringUtils.hasText(outputText)) {
            return outputText;
        }

        return extractAdviceTextFromNode(root, 0);
    }

    private Map<String, Object> buildInputs(Map<String, Object> context) {
        if (!StringUtils.hasText(inputVariable)) {
            return context;
        }

        Map<String, Object> wrappedInputs = new LinkedHashMap<>();
        Map<String, Object> healthContext = buildHealthContext(context);
        wrappedInputs.put(inputVariable, inputStringify ? writeJson(healthContext) : healthContext);
        return wrappedInputs;
    }

    private Map<String, Object> buildHealthContext(Map<String, Object> context) {
        Map<String, Object> healthContext = new LinkedHashMap<>();
        healthContext.put("date", context.get("date"));
        healthContext.put("user", context.get("user"));
        healthContext.put("profile", context.get("profile"));
        healthContext.put("summary", context.get("summary"));

        Map<String, Object> records = new LinkedHashMap<>();
        records.put("diet", context.getOrDefault("dietRecords", List.of()));
        records.put("exercise", context.getOrDefault("exerciseRecords", List.of()));
        records.put("care", context.getOrDefault("careRecords", List.of()));
        healthContext.put("records", records);

        Object latestForecast = context.get("latestForecast");
        if (latestForecast != null) {
            healthContext.put("latestForecast", latestForecast);
        }

        Object latestMessage = context.get("latestMessage");
        if (latestMessage != null) {
            healthContext.put("latestMessage", latestMessage);
        }

        return healthContext;
    }

    private String extractAdviceTextFromNode(JsonNode node, int depth) {
        if (depth > 6 || node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }

        JsonNode normalizedNode = normalizeNode(node);
        if (normalizedNode == null || normalizedNode.isMissingNode() || normalizedNode.isNull()) {
            return null;
        }

        if (normalizedNode.isTextual()) {
            String text = normalizedNode.asText(null);
            return StringUtils.hasText(text) ? text.trim() : null;
        }

        if (normalizedNode.isObject()) {
            for (String fieldName : PREFERRED_FIELD_NAMES) {
                String text = extractAdviceTextFromNode(normalizedNode.get(fieldName), depth + 1);
                if (StringUtils.hasText(text)) {
                    return text;
                }
            }

            if (normalizedNode.size() == 1) {
                Iterator<JsonNode> values = normalizedNode.elements();
                if (values.hasNext()) {
                    String text = extractAdviceTextFromNode(values.next(), depth + 1);
                    if (StringUtils.hasText(text)) {
                        return text;
                    }
                }
            }

            Iterator<Map.Entry<String, JsonNode>> fields = normalizedNode.fields();
            while (fields.hasNext()) {
                JsonNode value = fields.next().getValue();
                if (value != null && value.isTextual() && StringUtils.hasText(value.asText())) {
                    return value.asText().trim();
                }
            }

            fields = normalizedNode.fields();
            while (fields.hasNext()) {
                String text = extractAdviceTextFromNode(fields.next().getValue(), depth + 1);
                if (StringUtils.hasText(text)) {
                    return text;
                }
            }
        }

        if (normalizedNode.isArray() && normalizedNode.size() == 1) {
            return extractAdviceTextFromNode(normalizedNode.get(0), depth + 1);
        }

        return null;
    }

    private JsonNode normalizeNode(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }

        if (!node.isTextual()) {
            return node;
        }

        String text = node.asText(null);
        if (!StringUtils.hasText(text)) {
            return node;
        }

        try {
            JsonNode parsedNode = objectMapper.readTree(text);
            return parsedNode == null ? node : parsedNode;
        } catch (JsonProcessingException ex) {
            return node;
        }
    }

    private String writeJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    public record DifyAdviceResult(String adviceText, String source, String rawResponse) {
    }
}
