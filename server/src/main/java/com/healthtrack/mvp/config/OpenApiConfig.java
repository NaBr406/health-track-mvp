package com.healthtrack.mvp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 配置 OpenAPI / Swagger 的接口元数据，方便本地调试和联调。
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI healthTrackOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Health Track MVP API")
                        .version("0.0.1")
                        .description("基于 Dify 工作流的个性化饮食、运动、个人护理追踪平台 API"))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new Components().addSecuritySchemes(
                        "bearerAuth",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                ));
    }
}

