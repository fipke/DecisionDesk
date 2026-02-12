package com.decisiondesk.backend.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;

/**
 * Explicit Flyway configuration for Spring Boot 4.0.0-M1.
 * This ensures migrations run at startup.
 */
@Configuration
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);
    
    private final DataSource dataSource;
    
    public FlywayConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Run Flyway migrations on application startup.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void runFlywayMigrations() {
        log.info("Starting Flyway migration...");
        
        Flyway flyway = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .validateOnMigrate(true)
            .load();
        
        // Repair first to fix any issues
        try {
            flyway.repair();
        } catch (Exception e) {
            log.warn("Flyway repair note: {}", e.getMessage());
        }
        
        // Then migrate
        var result = flyway.migrate();
        log.info("Flyway migration complete. Applied {} migrations.", result.migrationsExecuted);
        
        if (result.migrationsExecuted > 0) {
            result.migrations.forEach(m -> 
                log.info("  Applied: V{} - {}", m.version, m.description)
            );
        }
    }
}
