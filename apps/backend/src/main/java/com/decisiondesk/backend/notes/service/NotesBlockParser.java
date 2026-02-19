package com.decisiondesk.backend.notes.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.decisiondesk.backend.notes.model.NotesBlock;

/**
 * Parses markdown notes to extract semantic blocks like action items, decisions, etc.
 * 
 * Block format:
 * ---
 * #BLOCK_TYPE
 * content here
 * ---
 */
@Component
public class NotesBlockParser {

    // Pattern to match blocks: --- followed by #TYPE, content, then ---
    private static final Pattern BLOCK_PATTERN = Pattern.compile(
            "^---\\s*\\n#([A-Za-zÀ-ÿ_\\s]+)\\n(.*?)\\n?---",
            Pattern.MULTILINE | Pattern.DOTALL
    );

    // Pattern for markdown checkboxes
    private static final Pattern CHECKBOX_PATTERN = Pattern.compile(
            "^\\s*-\\s*\\[([ xX])\\]\\s*(.*)$",
            Pattern.MULTILINE
    );

    // Pattern for @mentions
    private static final Pattern MENTION_PATTERN = Pattern.compile(
            "@([A-Za-zÀ-ÿ]+(?:\\s+[A-Za-zÀ-ÿ]+)?)"
    );

    /**
     * Parses markdown notes and extracts all semantic blocks.
     */
    public List<NotesBlock> parseBlocks(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return List.of();
        }

        List<NotesBlock> blocks = new ArrayList<>();
        Matcher matcher = BLOCK_PATTERN.matcher(markdown);

        while (matcher.find()) {
            String type = normalizeBlockType(matcher.group(1).trim());
            String content = matcher.group(2).trim();
            int startLine = countLines(markdown.substring(0, matcher.start()));
            int endLine = countLines(markdown.substring(0, matcher.end()));
            
            blocks.add(new NotesBlock(type, content, startLine, endLine));
        }

        return blocks;
    }

    /**
     * Extracts action items from the notes (parsed from ACTION_ITEMS blocks).
     */
    public List<ActionItem> extractActionItems(String markdown) {
        List<ActionItem> items = new ArrayList<>();
        
        for (NotesBlock block : parseBlocks(markdown)) {
            if (block.isActionItems() && block.hasContent()) {
                Matcher checkboxMatcher = CHECKBOX_PATTERN.matcher(block.content());
                while (checkboxMatcher.find()) {
                    String checkState = checkboxMatcher.group(1);
                    String text = checkboxMatcher.group(2).trim();
                    boolean completed = "x".equalsIgnoreCase(checkState);
                    String assignee = extractMention(text);
                    
                    if (!text.isEmpty()) {
                        items.add(new ActionItem(text, completed, assignee));
                    }
                }
            }
        }

        return items;
    }

    /**
     * Extracts decisions from the notes.
     */
    public List<String> extractDecisions(String markdown) {
        List<String> decisions = new ArrayList<>();
        
        for (NotesBlock block : parseBlocks(markdown)) {
            if (block.isDecisions() && block.hasContent()) {
                // Split by lines, filter non-empty, strip leading bullets
                String[] lines = block.content().split("\\n");
                for (String line : lines) {
                    String trimmed = line.trim();
                    if (!trimmed.isEmpty()) {
                        // Remove leading - or * bullet
                        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
                            trimmed = trimmed.substring(1).trim();
                        }
                        if (!trimmed.isEmpty()) {
                            decisions.add(trimmed);
                        }
                    }
                }
            }
        }

        return decisions;
    }

    /**
     * Removes empty blocks from markdown (cleans up template).
     */
    public String cleanEmptyBlocks(String markdown) {
        if (markdown == null) {
            return null;
        }

        StringBuilder result = new StringBuilder(markdown);
        List<NotesBlock> blocks = parseBlocks(markdown);
        
        // Remove in reverse order to maintain line positions
        for (int i = blocks.size() - 1; i >= 0; i--) {
            NotesBlock block = blocks.get(i);
            if (!block.hasContent()) {
                // Find and remove the entire block from the original
                Matcher matcher = BLOCK_PATTERN.matcher(result);
                while (matcher.find()) {
                    String type = normalizeBlockType(matcher.group(1).trim());
                    if (type.equals(block.type())) {
                        result.replace(matcher.start(), matcher.end(), "");
                        break;
                    }
                }
            }
        }

        // Clean up multiple consecutive newlines
        return result.toString().replaceAll("\\n{3,}", "\n\n").trim();
    }

    /**
     * Extracts @mention from text.
     */
    private String extractMention(String text) {
        Matcher matcher = MENTION_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    /**
     * Normalizes block type to standard format.
     */
    private String normalizeBlockType(String type) {
        return type.toUpperCase()
                .replace(" ", "_")
                .replace("Ã", "A")
                .replace("Á", "A")
                .replace("É", "E")
                .replace("Í", "I")
                .replace("Ó", "O")
                .replace("Õ", "O")
                .replace("Ú", "U")
                .replace("Ç", "C");
    }

    private int countLines(String text) {
        return (int) text.chars().filter(c -> c == '\n').count() + 1;
    }

    /**
     * Represents a parsed action item.
     */
    public record ActionItem(String text, boolean completed, String assignee) {
        
        /**
         * Returns the action item text without the @mention.
         */
        public String textWithoutMention() {
            if (assignee == null) {
                return text;
            }
            return text.replaceFirst("@" + Pattern.quote(assignee) + "\\s*", "").trim();
        }
    }
}
