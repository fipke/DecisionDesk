package com.decisiondesk.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Entry point for the DecisionDesk backend service.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class DecisionDeskApplication {

    /**
     * Bootstraps the Spring application context.
     *
     * @param args command-line arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(DecisionDeskApplication.class, args);
    }
}
