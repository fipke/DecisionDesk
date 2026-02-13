package com.decisiondesk.backend.api.v1.notes;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.notes.service.TranscriptImportService;
import com.decisiondesk.backend.notes.service.TranscriptImportService.ImportResult;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller for importing transcripts.
 */
@RestController
@RequestMapping("/api/v1/import")
@Tag(name = "Import", description = "Operations for importing transcripts and documents")
public class TranscriptImportController {

    private final TranscriptImportService importService;

    public TranscriptImportController(TranscriptImportService importService) {
        this.importService = importService;
    }

    @Operation(summary = "Import transcript from file (creates new meeting)")
    @PostMapping("/file")
    public ResponseEntity<ImportResult> importFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "title", required = false) String title) {
        ImportResult result = importService.importTranscript(file, source, title);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @Operation(summary = "Import transcript from text (creates new meeting)")
    @PostMapping("/text")
    public ResponseEntity<ImportResult> importText(@RequestBody ImportTextRequest request) {
        ImportResult result = importService.importText(
                request.text(),
                request.title(),
                request.source()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    public record ImportTextRequest(
            String text,
            String title,
            String source
    ) {}
}
