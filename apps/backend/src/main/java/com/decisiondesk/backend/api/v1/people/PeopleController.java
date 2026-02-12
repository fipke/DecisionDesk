package com.decisiondesk.backend.api.v1.people;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.people.PersonService;
import com.decisiondesk.backend.people.model.PersonRole;

/**
 * REST controller for people management and @mention autocomplete.
 */
@RestController
@RequestMapping("/api/v1/people")
public class PeopleController {

    private final PersonService personService;

    public PeopleController(PersonService personService) {
        this.personService = personService;
    }

    /**
     * Search people for autocomplete.
     * GET /api/v1/people/search?q=Rod
     */
    @GetMapping("/search")
    public List<PersonResponse> search(@RequestParam("q") String query) {
        return personService.searchPeople(query).stream()
            .map(PersonResponse::from)
            .toList();
    }

    /**
     * List all people.
     * GET /api/v1/people
     */
    @GetMapping
    public List<PersonResponse> list() {
        return personService.getAllPeople().stream()
            .map(PersonResponse::from)
            .toList();
    }

    /**
     * Get a person by id.
     * GET /api/v1/people/{id}
     */
    @GetMapping("/{id}")
    public PersonResponse get(@PathVariable UUID id) {
        return PersonResponse.from(personService.getPerson(id));
    }

    /**
     * Create a new person.
     * POST /api/v1/people
     */
    @PostMapping
    public PersonResponse create(@RequestBody PersonRequest request) {
        return PersonResponse.from(
            personService.createPerson(
                request.displayName(),
                request.fullName(),
                request.email(),
                request.notes()
            )
        );
    }

    /**
     * Update a person.
     * PUT /api/v1/people/{id}
     */
    @PutMapping("/{id}")
    public PersonResponse update(@PathVariable UUID id, @RequestBody PersonRequest request) {
        return PersonResponse.from(
            personService.updatePerson(
                id,
                request.displayName(),
                request.fullName(),
                request.email(),
                request.notes()
            )
        );
    }

    /**
     * Delete a person.
     * DELETE /api/v1/people/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        if (personService.deletePerson(id)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    /**
     * Find or create a person by display name.
     * Used when selecting "Add new person" from autocomplete.
     * POST /api/v1/people/find-or-create
     */
    @PostMapping("/find-or-create")
    public PersonResponse findOrCreate(@RequestBody PersonRequest request) {
        return PersonResponse.from(
            personService.findOrCreate(request.displayName())
        );
    }
}
