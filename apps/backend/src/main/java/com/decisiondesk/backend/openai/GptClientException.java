package com.decisiondesk.backend.openai;

/**
 * Exception thrown when GPT API calls fail.
 */
public class GptClientException extends RuntimeException {
    
    public GptClientException(String message) {
        super(message);
    }
    
    public GptClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
