package com.decisiondesk.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.accept.ApiVersionParser;
import org.springframework.web.servlet.config.annotation.ApiVersionConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Enables Spring MVC API versioning so controllers can declare supported versions.
 */
@Configuration
public class ApiVersioningConfig implements WebMvcConfigurer {

    @Override
    public void configureApiVersioning(ApiVersionConfigurer configurer) {
        configurer
                .usePathSegment(1)
                .setVersionParser((ApiVersionParser<Integer>) version -> {
                    String raw = version.startsWith("v") ? version.substring(1) : version;
                    return Integer.parseInt(raw);
                })
                .addSupportedVersions("v1")
                .setDefaultVersion("v1")
                .setVersionRequired(true);
    }
}
