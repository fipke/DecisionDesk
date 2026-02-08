package com.decisiondesk.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "openai.api-key=test-key"
})
class DecisionDeskApplicationTests {

    @Test
    void contextLoads() {
        // Ensures the Spring context can start with the current configuration.
    }
}
