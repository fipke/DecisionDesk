package com.decisiondesk.backend.people;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.decisiondesk.backend.people.model.MeetingPerson;
import com.decisiondesk.backend.people.model.Person;
import com.decisiondesk.backend.people.model.PersonRole;
import com.decisiondesk.backend.people.persistence.MeetingPersonRepository;
import com.decisiondesk.backend.people.persistence.MeetingPersonRepository.PersonWithRole;
import com.decisiondesk.backend.people.persistence.PersonRepository;

/**
 * Service layer for people operations.
 */
@Service
public class PersonService {

    private static final int DEFAULT_SEARCH_LIMIT = 10;

    private final PersonRepository personRepository;
    private final MeetingPersonRepository meetingPersonRepository;

    public PersonService(PersonRepository personRepository, MeetingPersonRepository meetingPersonRepository) {
        this.personRepository = personRepository;
        this.meetingPersonRepository = meetingPersonRepository;
    }

    // ========== Person CRUD ==========

    /**
     * Creates a new person.
     */
    public Person createPerson(String displayName, String fullName, String email, String notes) {
        Person person = Person.create(displayName, fullName, email, notes);
        return personRepository.create(person);
    }

    /**
     * Gets a person by id.
     */
    public Person getPerson(UUID id) {
        return personRepository.findById(id)
            .orElseThrow(() -> new PersonNotFoundException(id));
    }

    /**
     * Gets all people.
     */
    public List<Person> getAllPeople() {
        return personRepository.findAll();
    }

    /**
     * Searches people by name for autocomplete.
     * 
     * @param query the search prefix
     * @return matching people (limited to 10)
     */
    public List<Person> searchPeople(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return personRepository.search(query.trim(), DEFAULT_SEARCH_LIMIT);
    }

    /**
     * Updates a person.
     */
    public Person updatePerson(UUID id, String displayName, String fullName, String email, String notes) {
        Person existing = getPerson(id);
        
        Person updated = new Person(
            existing.id(),
            displayName != null ? displayName : existing.displayName(),
            fullName,  // allow setting to null
            email,     // allow setting to null
            notes,     // allow setting to null
            existing.createdAt(),
            java.time.OffsetDateTime.now()
        );
        
        return personRepository.update(updated);
    }

    /**
     * Deletes a person.
     */
    public boolean deletePerson(UUID id) {
        return personRepository.delete(id);
    }

    /**
     * Finds or creates a person by display name.
     * Used when user selects "Add new person" in autocomplete.
     */
    public Person findOrCreate(String displayName) {
        return personRepository.findByDisplayName(displayName)
            .orElseGet(() -> createPerson(displayName, null, null, null));
    }

    // ========== Meeting-Person associations ==========

    /**
     * Adds a person to a meeting as participant.
     */
    public MeetingPerson addParticipant(UUID meetingId, UUID personId) {
        return meetingPersonRepository.addPersonToMeeting(meetingId, personId, PersonRole.PARTICIPANT);
    }

    /**
     * Adds a person to a meeting as mentioned.
     */
    public MeetingPerson addMention(UUID meetingId, UUID personId) {
        return meetingPersonRepository.addPersonToMeeting(meetingId, personId, PersonRole.MENTIONED);
    }

    /**
     * Adds a person to a meeting with specified role.
     */
    public MeetingPerson addPersonToMeeting(UUID meetingId, UUID personId, PersonRole role) {
        return meetingPersonRepository.addPersonToMeeting(meetingId, personId, role);
    }

    /**
     * Removes a person from a meeting.
     */
    public boolean removePersonFromMeeting(UUID meetingId, UUID personId, PersonRole role) {
        return meetingPersonRepository.removePersonFromMeeting(meetingId, personId, role);
    }

    /**
     * Gets all people associated with a meeting.
     */
    public List<PersonWithRole> getMeetingPeople(UUID meetingId) {
        return meetingPersonRepository.findPeopleByMeeting(meetingId);
    }

    /**
     * Gets participants of a meeting.
     */
    public List<Person> getParticipants(UUID meetingId) {
        return meetingPersonRepository.findParticipants(meetingId);
    }

    /**
     * Gets mentioned people in a meeting.
     */
    public List<Person> getMentioned(UUID meetingId) {
        return meetingPersonRepository.findMentioned(meetingId);
    }
}
