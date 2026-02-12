package com.decisiondesk.backend.api.v1.folders;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.folders.FolderService;
import com.decisiondesk.backend.folders.model.Folder;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/**
 * REST controller for folder operations (PR07).
 */
@RestController
@RequestMapping(path = "/api/v1/folders", produces = MediaType.APPLICATION_JSON_VALUE)
public class FoldersController {

    private final FolderService folderService;

    public FoldersController(FolderService folderService) {
        this.folderService = folderService;
    }

    @PostMapping
    @Operation(summary = "Create a folder", description = "Creates a new folder for organizing meetings")
    @ApiResponse(responseCode = "201", description = "Folder created", content = @Content(schema = @Schema(implementation = FolderResponse.class)))
    @ResponseStatus(HttpStatus.CREATED)
    public FolderResponse createFolder(@RequestBody FolderRequest request) {
        Folder folder = folderService.createFolder(
            request.nameOrDefault(),
            request.parentId(),
            request.defaultTags(),
            request.defaultWhisperModel()
        );
        return toResponse(folder);
    }

    @GetMapping
    @Operation(summary = "List all folders", description = "Returns all folders in hierarchical order")
    @ApiResponse(responseCode = "200", description = "Folders retrieved")
    public List<FolderResponse> listFolders(
            @RequestParam(required = false) UUID parentId) {
        List<Folder> folders = parentId != null 
            ? folderService.getChildFolders(parentId)
            : folderService.getAllFolders();
        return folders.stream().map(this::toResponse).toList();
    }

    @GetMapping("/{folderId}")
    @Operation(summary = "Get folder details", description = "Returns details of a specific folder")
    @ApiResponse(responseCode = "200", description = "Folder retrieved", content = @Content(schema = @Schema(implementation = FolderResponse.class)))
    public FolderResponse getFolder(@PathVariable UUID folderId) {
        Folder folder = folderService.getFolder(folderId);
        return toResponse(folder);
    }

    @PutMapping("/{folderId}")
    @Operation(summary = "Update a folder", description = "Updates folder name, tags, or whisper model")
    @ApiResponse(responseCode = "200", description = "Folder updated", content = @Content(schema = @Schema(implementation = FolderResponse.class)))
    public FolderResponse updateFolder(@PathVariable UUID folderId, @RequestBody FolderRequest request) {
        Folder folder = folderService.updateFolder(
            folderId,
            request.name(),
            request.defaultTags(),
            request.defaultWhisperModel()
        );
        return toResponse(folder);
    }

    @DeleteMapping("/{folderId}")
    @Operation(summary = "Delete a folder", description = "Deletes a folder and orphans its meetings")
    @ApiResponse(responseCode = "204", description = "Folder deleted")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFolder(@PathVariable UUID folderId) {
        folderService.deleteFolder(folderId);
    }

    private FolderResponse toResponse(Folder folder) {
        return new FolderResponse(
            folder.id(),
            folder.name(),
            folder.path(),
            folder.parentId(),
            folder.defaultTags(),
            folder.defaultWhisperModel(),
            folder.createdAt(),
            folder.updatedAt()
        );
    }
}
