package com.decisiondesk.backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures OpenAPI metadata and grouping.
 */
@Configuration
public class OpenApiConfiguration {

    /**
     * Declares a group covering the public versioned API endpoints.
     *
     * @return configured {@link GroupedOpenApi}
     */
    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder()
                .group("api-v1")
                .pathsToMatch("/api/v1/**")
                .build();
    }

    /**
     * Provides the root OpenAPI document with minimal metadata.
     *
     * @return an {@link OpenAPI} descriptor used by springdoc
     */
    @Bean
    public OpenAPI decisionDeskOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("DecisionDesk API")
                        .version("v1")
                        .description("API surface for the DecisionDesk MVP")
                        .contact(new Contact().name("DecisionDesk")));
    }
}
