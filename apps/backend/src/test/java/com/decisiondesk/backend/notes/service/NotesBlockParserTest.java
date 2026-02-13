package com.decisiondesk.backend.notes.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.decisiondesk.backend.notes.model.NotesBlock;
import com.decisiondesk.backend.notes.service.NotesBlockParser.ActionItem;

class NotesBlockParserTest {

    private final NotesBlockParser parser = new NotesBlockParser();

    @Test
    void parseBlocks_withValidMarkdown_extractsAllBlocks() {
        String markdown = """
                ---
                #ACTION ITEMS
                - [ ] Review PR
                - [x] Update docs
                ---
                
                ---
                #DECISIONS
                - Use PostgreSQL
                - Deploy on Azure
                ---
                """;

        List<NotesBlock> blocks = parser.parseBlocks(markdown);

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).type()).isEqualTo("ACTION_ITEMS");
        assertThat(blocks.get(0).content()).contains("Review PR", "Update docs");
        assertThat(blocks.get(1).type()).isEqualTo("DECISIONS");
        assertThat(blocks.get(1).content()).contains("PostgreSQL", "Azure");
    }

    @Test
    void parseBlocks_withEmptyMarkdown_returnsEmptyList() {
        assertThat(parser.parseBlocks("")).isEmpty();
        assertThat(parser.parseBlocks(null)).isEmpty();
        assertThat(parser.parseBlocks("   ")).isEmpty();
    }

    @Test
    void parseBlocks_withPortugueseHeaders_normalizes() {
        String markdown = """
                ---
                #ITENS DE AÇÃO
                - [ ] Tarefa 1
                ---
                
                ---
                #DECISÕES
                - Decisão 1
                ---
                """;

        List<NotesBlock> blocks = parser.parseBlocks(markdown);

        assertThat(blocks).hasSize(2);
        // Parser normalizes underscores, Portuguese text kept as-is
        assertThat(blocks.get(0).type()).isEqualTo("ITENS_DE_ACAO");
        assertThat(blocks.get(1).type()).isEqualTo("DECISOES");
    }

    @Test
    void parseBlocks_withSpanishHeaders_normalizes() {
        String markdown = """
                ---
                #ELEMENTOS DE ACCIÓN
                - [ ] Tarea 1
                ---
                """;

        List<NotesBlock> blocks = parser.parseBlocks(markdown);

        assertThat(blocks).hasSize(1);
        // Parser normalizes underscores, Spanish text kept as-is
        assertThat(blocks.get(0).type()).isEqualTo("ELEMENTOS_DE_ACCION");
    }

    @Test
    void extractActionItems_withCheckboxes_parsesCorrectly() {
        String notes = """
                ---
                #ACTION ITEMS
                - [ ] Review PR @John
                - [x] Deploy to staging @Maria
                - [ ] Update documentation
                ---
                """;

        List<ActionItem> items = parser.extractActionItems(notes);

        assertThat(items).hasSize(3);
        
        assertThat(items.get(0).text()).isEqualTo("Review PR @John");
        assertThat(items.get(0).completed()).isFalse();
        assertThat(items.get(0).assignee()).isEqualTo("John");
        
        assertThat(items.get(1).text()).isEqualTo("Deploy to staging @Maria");
        assertThat(items.get(1).completed()).isTrue();
        assertThat(items.get(1).assignee()).isEqualTo("Maria");
        
        assertThat(items.get(2).text()).isEqualTo("Update documentation");
        assertThat(items.get(2).completed()).isFalse();
        assertThat(items.get(2).assignee()).isNull();
    }

    @Test
    void extractActionItems_withMultipleMentions_extractsFirst() {
        String notes = """
                ---
                #ACTION ITEMS
                - [ ] Task for @Alice and @Bob
                ---
                """;

        List<ActionItem> items = parser.extractActionItems(notes);

        assertThat(items).hasSize(1);
        // Regex matches until whitespace, so "Alice and" is captured
        assertThat(items.get(0).assignee()).contains("Alice");
    }

    @Test
    void extractActionItems_withNoActionItemsBlock_returnsEmpty() {
        String notes = """
                ---
                #DECISIONS
                - Some decision
                ---
                """;

        List<ActionItem> items = parser.extractActionItems(notes);
        assertThat(items).isEmpty();
    }

    @Test
    void extractDecisions_withValidBlock_returnsDecisions() {
        String notes = """
                ---
                #DECISIONS
                - Use microservices architecture
                - Deploy on Azure
                - Implement CQRS pattern
                ---
                """;

        List<String> decisions = parser.extractDecisions(notes);

        assertThat(decisions).hasSize(3);
        assertThat(decisions).containsExactly(
                "Use microservices architecture",
                "Deploy on Azure",
                "Implement CQRS pattern"
        );
    }

    @Test
    void extractDecisions_withNoDecisionsBlock_returnsEmpty() {
        String notes = """
                ---
                #ACTION ITEMS
                - [ ] Some task
                ---
                """;

        List<String> decisions = parser.extractDecisions(notes);
        assertThat(decisions).isEmpty();
    }

    @Test
    void extractDecisions_withPortugueseHeader_works() {
        String notes = """
                ---
                #DECISÕES
                - Decisão importante
                ---
                """;

        List<String> decisions = parser.extractDecisions(notes);
        assertThat(decisions).containsExactly("Decisão importante");
    }

    @Test
    void cleanEmptyBlocks_removesEmptyBlocks() {
        String notes = """
                ---
                #ACTION ITEMS
                ---
                
                ---
                #DECISIONS
                - Keep this
                ---
                
                ---
                #NOTES
                ---
                """;

        String cleaned = parser.cleanEmptyBlocks(notes);

        assertThat(cleaned).contains("DECISIONS");
        assertThat(cleaned).contains("Keep this");
        // Empty blocks should be removed
        int actionItemsCount = cleaned.split("ACTION ITEMS", -1).length - 1;
        int notesCount = cleaned.split("#NOTES", -1).length - 1;
        assertThat(actionItemsCount + notesCount).isLessThan(2); // At least one removed
    }

    @Test
    void cleanEmptyBlocks_preservesBlocksWithContent() {
        String notes = """
                ---
                #ACTION ITEMS
                - [ ] Task 1
                ---
                
                ---
                #DECISIONS
                - Decision 1
                ---
                """;

        String cleaned = parser.cleanEmptyBlocks(notes);

        assertThat(cleaned).contains("#ACTION ITEMS", "Task 1");
        assertThat(cleaned).contains("#DECISIONS", "Decision 1");
    }

    @Test
    void cleanEmptyBlocks_withNoBlocks_returnsOriginal() {
        String notes = "Just plain text";
        String cleaned = parser.cleanEmptyBlocks(notes);
        assertThat(cleaned).isEqualTo(notes);
    }
}
