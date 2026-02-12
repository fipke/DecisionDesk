package com.decisiondesk.backend.folders;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.decisiondesk.backend.folders.model.Folder;
import com.decisiondesk.backend.folders.persistence.FolderRepository;

/**
 * Service layer for folder operations.
 */
@Service
public class FolderService {

    private final FolderRepository folderRepository;

    public FolderService(FolderRepository folderRepository) {
        this.folderRepository = folderRepository;
    }

    /**
     * Creates a new folder under the specified parent.
     *
     * @param name folder name
     * @param parentId parent folder id (null for root level)
     * @param defaultTags default tags for meetings
     * @param defaultWhisperModel default whisper model
     * @return the created folder
     */
    public Folder createFolder(String name, UUID parentId, Map<String, String> defaultTags, String defaultWhisperModel) {
        String path = buildPath(name, parentId);
        
        Folder folder = new Folder(
            UUID.randomUUID(),
            name,
            path,
            parentId,
            defaultTags != null ? defaultTags : Map.of(),
            defaultWhisperModel,
            null,
            java.time.OffsetDateTime.now(),
            java.time.OffsetDateTime.now()
        );
        
        return folderRepository.create(folder);
    }

    /**
     * Gets a folder by id.
     *
     * @param id folder id
     * @return the folder
     * @throws FolderNotFoundException if not found
     */
    public Folder getFolder(UUID id) {
        return folderRepository.findById(id)
            .orElseThrow(() -> new FolderNotFoundException(id));
    }

    /**
     * Gets all folders.
     *
     * @return list of all folders
     */
    public List<Folder> getAllFolders() {
        return folderRepository.findAll();
    }

    /**
     * Gets child folders of a parent.
     *
     * @param parentId parent folder id
     * @return list of child folders
     */
    public List<Folder> getChildFolders(UUID parentId) {
        return folderRepository.findByParentId(parentId);
    }

    /**
     * Updates a folder.
     *
     * @param id folder id
     * @param name new name (null to keep)
     * @param defaultTags new default tags (null to keep)
     * @param defaultWhisperModel new model (null to keep)
     * @return the updated folder
     */
    public Folder updateFolder(UUID id, String name, Map<String, String> defaultTags, String defaultWhisperModel) {
        Folder existing = getFolder(id);
        
        Folder updated = new Folder(
            existing.id(),
            name != null ? name : existing.name(),
            name != null ? buildPath(name, existing.parentId()) : existing.path(),
            existing.parentId(),
            defaultTags != null ? defaultTags : existing.defaultTags(),
            defaultWhisperModel != null ? defaultWhisperModel : existing.defaultWhisperModel(),
            existing.summaryTemplateId(),
            existing.createdAt(),
            java.time.OffsetDateTime.now()
        );
        
        folderRepository.update(updated);
        return folderRepository.findById(id).orElseThrow();
    }

    /**
     * Deletes a folder.
     *
     * @param id folder id
     */
    public void deleteFolder(UUID id) {
        folderRepository.deleteById(id);
    }

    private String buildPath(String name, UUID parentId) {
        if (parentId == null) {
            return "/" + name;
        }
        Folder parent = folderRepository.findById(parentId)
            .orElseThrow(() -> new FolderNotFoundException(parentId));
        return parent.path().equals("/") ? "/" + name : parent.path() + "/" + name;
    }

    /**
     * Exception thrown when a folder is not found.
     */
    public static class FolderNotFoundException extends RuntimeException {
        public FolderNotFoundException(UUID id) {
            super("Folder not found: " + id);
        }
    }
}
