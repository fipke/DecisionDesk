package com.decisiondesk.backend.folders.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.folders.model.Folder;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Repository responsible for CRUD interactions with the {@code folders} table.
 */
@Repository
public class FolderRepository {

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public FolderRepository(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Creates a new folder.
     *
     * @param folder the folder to persist
     * @return the persisted folder
     */
    public Folder create(Folder folder) {
        jdbcClient.sql("""
                INSERT INTO folders (id, name, path, parent_id, default_tags, default_whisper_model, summary_template_id)
                VALUES (:id, :name, :path, :parentId, :defaultTags::jsonb, :defaultWhisperModel, :summaryTemplateId)
                """)
                .param("id", folder.id())
                .param("name", folder.name())
                .param("path", folder.path())
                .param("parentId", folder.parentId())
                .param("defaultTags", toJson(folder.defaultTags()))
                .param("defaultWhisperModel", folder.defaultWhisperModel())
                .param("summaryTemplateId", folder.summaryTemplateId())
                .update();
        return findById(folder.id()).orElseThrow();
    }

    /**
     * Finds a folder by identifier.
     *
     * @param id target folder
     * @return optional folder
     */
    public Optional<Folder> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, name, path, parent_id, default_tags, default_whisper_model, 
                       summary_template_id, created_at, updated_at 
                FROM folders WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapFolder)
                .optional();
    }

    /**
     * Finds a folder by its path.
     *
     * @param path the folder path
     * @return optional folder
     */
    public Optional<Folder> findByPath(String path) {
        return jdbcClient.sql("""
                SELECT id, name, path, parent_id, default_tags, default_whisper_model, 
                       summary_template_id, created_at, updated_at 
                FROM folders WHERE path = :path
                """)
                .param("path", path)
                .query(this::mapFolder)
                .optional();
    }

    /**
     * Returns all folders.
     *
     * @return list of all folders
     */
    public List<Folder> findAll() {
        return jdbcClient.sql("""
                SELECT id, name, path, parent_id, default_tags, default_whisper_model, 
                       summary_template_id, created_at, updated_at 
                FROM folders ORDER BY path
                """)
                .query(this::mapFolder)
                .list();
    }

    /**
     * Returns all child folders of a parent.
     *
     * @param parentId the parent folder id
     * @return list of child folders
     */
    public List<Folder> findByParentId(UUID parentId) {
        return jdbcClient.sql("""
                SELECT id, name, path, parent_id, default_tags, default_whisper_model, 
                       summary_template_id, created_at, updated_at 
                FROM folders WHERE parent_id = :parentId ORDER BY name
                """)
                .param("parentId", parentId)
                .query(this::mapFolder)
                .list();
    }

    /**
     * Updates a folder.
     *
     * @param folder the folder with updated values
     * @return number of rows updated
     */
    public int update(Folder folder) {
        return jdbcClient.sql("""
                UPDATE folders SET 
                    name = :name, 
                    path = :path, 
                    parent_id = :parentId,
                    default_tags = :defaultTags::jsonb, 
                    default_whisper_model = :defaultWhisperModel,
                    summary_template_id = :summaryTemplateId,
                    updated_at = NOW()
                WHERE id = :id
                """)
                .param("id", folder.id())
                .param("name", folder.name())
                .param("path", folder.path())
                .param("parentId", folder.parentId())
                .param("defaultTags", toJson(folder.defaultTags()))
                .param("defaultWhisperModel", folder.defaultWhisperModel())
                .param("summaryTemplateId", folder.summaryTemplateId())
                .update();
    }

    /**
     * Deletes a folder by id.
     *
     * @param id folder identifier
     * @return number of rows deleted
     */
    public int deleteById(UUID id) {
        return jdbcClient.sql("DELETE FROM folders WHERE id = :id")
                .param("id", id)
                .update();
    }

    private Folder mapFolder(ResultSet rs, int rowNum) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        String name = rs.getString("name");
        String path = rs.getString("path");
        UUID parentId = rs.getObject("parent_id", UUID.class);
        Map<String, String> defaultTags = fromJson(rs.getString("default_tags"));
        String defaultWhisperModel = rs.getString("default_whisper_model");
        UUID summaryTemplateId = rs.getObject("summary_template_id", UUID.class);
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
        OffsetDateTime updatedAt = rs.getObject("updated_at", OffsetDateTime.class);
        
        return new Folder(id, name, path, parentId, defaultTags, defaultWhisperModel, 
                         summaryTemplateId, createdAt, updatedAt);
    }

    private String toJson(Map<String, String> map) {
        try {
            return objectMapper.writeValueAsString(map != null ? map : Map.of());
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private Map<String, String> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
