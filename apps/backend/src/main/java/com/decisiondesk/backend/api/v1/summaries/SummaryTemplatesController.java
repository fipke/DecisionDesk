package com.decisiondesk.backend.api.v1.summaries;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.summaries.model.SummaryTemplate;
import com.decisiondesk.backend.summaries.persistence.SummaryTemplateRepository;
import com.decisiondesk.backend.web.ApiException;

/**
 * REST API for managing summary templates.
 */
@RestController
@RequestMapping("/api/v1/summary-templates")
public class SummaryTemplatesController {

    private final SummaryTemplateRepository repository;

    public SummaryTemplatesController(SummaryTemplateRepository repository) {
        this.repository = repository;
    }

    /**
     * Lists all summary templates.
     */
    @GetMapping
    public List<SummaryTemplate> list() {
        return repository.findAll();
    }

    /**
     * Gets a specific template by ID.
     */
    @GetMapping("/{id}")
    public SummaryTemplate get(@PathVariable UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "TEMPLATE_NOT_FOUND", "Summary template not found: " + id));
    }

    /**
     * Gets the default template.
     */
    @GetMapping("/default")
    public SummaryTemplate getDefault() {
        return repository.findDefault()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "NO_DEFAULT_TEMPLATE", "No default summary template configured"));
    }

    /**
     * Creates a new template.
     */
    @PostMapping
    public ResponseEntity<SummaryTemplate> create(@RequestBody CreateTemplateRequest request) {
        SummaryTemplate template = SummaryTemplate.create(
                request.name(),
                request.systemPrompt(),
                request.userPromptTemplate()
        );
        
        // Apply optional fields
        template = new SummaryTemplate(
                template.id(),
                request.name(),
                request.description(),
                request.systemPrompt(),
                request.userPromptTemplate(),
                request.outputFormat() != null ? request.outputFormat() : template.outputFormat(),
                request.model() != null ? request.model() : template.model(),
                request.maxTokens() != null ? request.maxTokens() : template.maxTokens(),
                request.temperature() != null ? request.temperature() : template.temperature(),
                request.isDefault() != null ? request.isDefault() : false,
                template.createdAt(),
                template.updatedAt()
        );
        
        SummaryTemplate created = repository.create(template);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Updates an existing template.
     */
    @PutMapping("/{id}")
    public SummaryTemplate update(@PathVariable UUID id, @RequestBody UpdateTemplateRequest request) {
        SummaryTemplate existing = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "TEMPLATE_NOT_FOUND", "Summary template not found: " + id));
        
        SummaryTemplate updated = new SummaryTemplate(
                existing.id(),
                request.name() != null ? request.name() : existing.name(),
                request.description() != null ? request.description() : existing.description(),
                request.systemPrompt() != null ? request.systemPrompt() : existing.systemPrompt(),
                request.userPromptTemplate() != null ? request.userPromptTemplate() : existing.userPromptTemplate(),
                request.outputFormat() != null ? request.outputFormat() : existing.outputFormat(),
                request.model() != null ? request.model() : existing.model(),
                request.maxTokens() != null ? request.maxTokens() : existing.maxTokens(),
                request.temperature() != null ? request.temperature() : existing.temperature(),
                request.isDefault() != null ? request.isDefault() : existing.isDefault(),
                existing.createdAt(),
                existing.updatedAt()
        );
        
        return repository.update(updated);
    }

    /**
     * Sets a template as the default.
     */
    @PostMapping("/{id}/set-default")
    public SummaryTemplate setDefault(@PathVariable UUID id) {
        repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "TEMPLATE_NOT_FOUND", "Summary template not found: " + id));
        repository.setAsDefault(id);
        return repository.findById(id).orElseThrow();
    }

    /**
     * Deletes a template.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "TEMPLATE_NOT_FOUND", "Summary template not found: " + id));
        repository.delete(id);
        return ResponseEntity.noContent().build();
    }

    // Request DTOs
    
    public record CreateTemplateRequest(
            String name,
            String description,
            String systemPrompt,
            String userPromptTemplate,
            String outputFormat,
            String model,
            Integer maxTokens,
            java.math.BigDecimal temperature,
            Boolean isDefault
    ) {}
    
    public record UpdateTemplateRequest(
            String name,
            String description,
            String systemPrompt,
            String userPromptTemplate,
            String outputFormat,
            String model,
            Integer maxTokens,
            java.math.BigDecimal temperature,
            Boolean isDefault
    ) {}
}
