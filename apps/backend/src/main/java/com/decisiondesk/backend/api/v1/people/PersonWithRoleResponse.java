package com.decisiondesk.backend.api.v1.people;

import com.decisiondesk.backend.people.model.PersonRole;

/**
 * Response for a person with their role in a meeting.
 */
public record PersonWithRoleResponse(
    PersonResponse person,
    String role
) {
    
    public static PersonWithRoleResponse from(
        com.decisiondesk.backend.people.persistence.MeetingPersonRepository.PersonWithRole pwr
    ) {
        return new PersonWithRoleResponse(
            PersonResponse.from(pwr.person()),
            pwr.role().getValue()
        );
    }
}
