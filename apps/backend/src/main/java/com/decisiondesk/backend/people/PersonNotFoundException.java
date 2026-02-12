package com.decisiondesk.backend.people;

import java.util.UUID;

/**
 * Exception thrown when a person is not found.
 */
public class PersonNotFoundException extends RuntimeException {
    
    private final UUID personId;

    public PersonNotFoundException(UUID personId) {
        super("Person not found: " + personId);
        this.personId = personId;
    }

    public UUID getPersonId() {
        return personId;
    }
}
