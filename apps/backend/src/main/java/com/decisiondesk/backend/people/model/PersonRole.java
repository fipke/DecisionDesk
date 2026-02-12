package com.decisiondesk.backend.people.model;

/**
 * Defines how a person is associated with a meeting.
 */
public enum PersonRole {
    /**
     * Person was a participant in the meeting.
     */
    PARTICIPANT("participant"),
    
    /**
     * Person was mentioned in the meeting notes.
     */
    MENTIONED("mentioned");
    
    private final String value;
    
    PersonRole(String value) {
        this.value = value;
    }
    
    public String getValue() {
        return value;
    }
    
    public static PersonRole fromValue(String value) {
        for (PersonRole role : values()) {
            if (role.value.equalsIgnoreCase(value)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Unknown PersonRole: " + value);
    }
}
