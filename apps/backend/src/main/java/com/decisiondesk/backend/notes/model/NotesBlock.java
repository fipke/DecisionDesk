package com.decisiondesk.backend.notes.model;

/**
 * Represents a parsed block from meeting notes markdown.
 * Blocks are delimited by --- with #BLOCK_TYPE header.
 */
public record NotesBlock(
    String type,       // ACTION_ITEMS, DECISIONS, etc.
    String content,    // The markdown content inside the block
    int startLine,     // Line number where block starts (for editing)
    int endLine        // Line number where block ends
) {
    
    public static final String BLOCK_DELIMITER = "---";
    public static final String TYPE_PREFIX = "#";
    
    // Standard block types
    public static final String ACTION_ITEMS = "ACTION_ITEMS";
    public static final String DECISIONS = "DECISIONS";
    public static final String TOPICS = "TOPICS";
    public static final String FOLLOW_UP = "FOLLOW_UP";
    public static final String PARKING_LOT = "PARKING_LOT";
    
    /**
     * Checks if this block has any meaningful content.
     */
    public boolean hasContent() {
        if (content == null || content.isBlank()) {
            return false;
        }
        // Check if it's just empty checkboxes
        String trimmed = content.trim();
        return !trimmed.isEmpty() && !trimmed.equals("- [ ]") && !trimmed.equals("- [ ] ");
    }
    
    /**
     * Checks if this is an action items block.
     */
    public boolean isActionItems() {
        return ACTION_ITEMS.equalsIgnoreCase(type) || 
               "ITENS DE AÇÃO".equalsIgnoreCase(type) ||
               "ITENS_DE_ACAO".equalsIgnoreCase(type) ||
               "TAREAS PENDIENTES".equalsIgnoreCase(type) ||
               "TAREAS_PENDIENTES".equalsIgnoreCase(type);
    }
    
    /**
     * Checks if this is a decisions block.
     */
    public boolean isDecisions() {
        return DECISIONS.equalsIgnoreCase(type) ||
               "DECISÕES".equalsIgnoreCase(type) ||
               "DECISOES".equalsIgnoreCase(type) ||
               "DECISIONES".equalsIgnoreCase(type);
    }
}
