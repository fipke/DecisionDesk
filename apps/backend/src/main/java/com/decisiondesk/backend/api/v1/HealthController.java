package com.decisiondesk.backend.api.v1;

import java.time.OffsetDateTime;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.config.AppProps;

/**
 * API health endpoint exposed to clients.
 */
@RestController
@RequestMapping(path = "/api/v1/health", produces = MediaType.APPLICATION_JSON_VALUE)
public class HealthController {

    private final AppProps appProps;

    /**
     * Creates the health controller with application metadata injected.
     *
     * @param appProperties shared application configuration
     */
    public HealthController(AppProps appProps) {
        this.appProps = appProps;
    }

    /**
     * Reports a minimal health payload so clients can validate connectivity.
     *
     * @return the current health response
     */
    @GetMapping
    public HealthResponse getHealth() {
        return new HealthResponse("ok", appProps.version(), OffsetDateTime.now());
    }

    /**
     * Response contract for the health endpoint.
     *
     * @param status textual status (e.g. "ok")
     * @param version semantic version string advertised by the backend
     * @param time timestamp when the response was generated
     */
    public record HealthResponse(String status, String version, OffsetDateTime time) {
    }
}
