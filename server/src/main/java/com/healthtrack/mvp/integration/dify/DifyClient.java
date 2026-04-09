package com.healthtrack.mvp.integration.dify;

import com.fasterxml.jackson.databind.JsonNode;
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

    private final RestClient restClient;

    @Value("${app.dify.base-url:}")
    private String baseUrl;

    @Value("${app.dify.api-key:}")
    private String apiKey;

    @Value("${app.dify.workflow-id:}")
    private String workflowId;

    public Optional<DifyAdviceResult> generateDailyAdvice(Long userId, LocalDate adviceDate, Map<String, Object> context) {
        if (!StringUtils.hasText(baseUrl) || !StringUtils.hasText(apiKey)) {
            return Optional.empty();
        }

        String normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String endpoint = StringUtils.hasText(workflowId)
                ? normalizedBaseUrl + "/v1/workflows/" + workflowId + "/run"
                : normalizedBaseUrl + "/v1/workflows/run";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("inputs", context);
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
                adviceText = "Dify 已返回响应，但当前工作流输出字段还未完成映射，请在 DifyClient 中补充字段解析。";
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

        List<String> candidatePaths = List.of(
                "/data/outputs/text",
                "/data/outputs/advice",
                "/data/outputs/answer",
                "/data/output/text",
                "/answer"
        );

        for (String path : candidatePaths) {
            JsonNode candidate = root.at(path);
            if (!candidate.isMissingNode() && !candidate.isNull()) {
                String text = candidate.asText();
                if (StringUtils.hasText(text)) {
                    return text;
                }
            }
        }

        JsonNode outputs = root.at("/data/outputs");
        if (outputs.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = outputs.fields();
            while (fields.hasNext()) {
                JsonNode value = fields.next().getValue();
                if (value.isTextual() && StringUtils.hasText(value.asText())) {
                    return value.asText();
                }
            }
        }

        return null;
    }

    public record DifyAdviceResult(String adviceText, String source, String rawResponse) {
    }
}
