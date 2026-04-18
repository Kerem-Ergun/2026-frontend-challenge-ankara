/**
 * Data Normalization Utility for Investigation Dashboard
 * Aggregates data from multiple Jotform submissions and creates a master record by person
 */

/**
 * Normalize a person's name for matching
 * Handles different spellings, case sensitivity, extra spaces
 */
export const normalizeName = (name) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, ''); // Remove special characters
};

/**
 * Fuzzy match for finding the same person across different records
 * Returns similarity score 0-1
 */
export const getSimilarityScore = (name1, name2) => {
    const n1 = normalizeName(name1);
    const n2 = normalizeName(name2);

    if (n1 === n2) return 1.0;
    if (n1.length === 0 || n2.length === 0) return 0;

    // Levenshtein distance
    const matrix = [];
    for (let i = 0; i <= n2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= n1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= n2.length; i++) {
        for (let j = 1; j <= n1.length; j++) {
            const cost = n2[i - 1] === n1[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const distance = matrix[n2.length][n1.length];
    const maxLength = Math.max(n1.length, n2.length);
    return 1 - distance / maxLength;
};

/**
 * Find or create a person profile with record linking
 * Uses similarity scoring to merge profiles for the same person
 */
export const findOrCreatePerson = (people, name, threshold = 0.85) => {
    const normalizedName = normalizeName(name);

    // Direct match
    if (people.has(normalizedName)) {
        return people.get(normalizedName);
    }

    // Fuzzy match
    for (const [key, profile] of people.entries()) {
        const score = getSimilarityScore(name, profile.name);
        if (score >= threshold) {
            profile.aliases.add(name);
            return profile;
        }
    }

    // Create new person
    const newPerson = {
        name,
        normalizedName,
        aliases: new Set([name]),
        locations: [],
        messages: [],
        sightings: {
            asSubject: [],
            withOthers: []
        },
        checkins: [],
        notes: [],
        tipsAbout: [],
        connectedPeople: new Set()
    };

    people.set(normalizedName, newPerson);
    return newPerson;
};

/**
 * Parse raw Jotform submission data and normalize it
 */
export const normalizeFormData = (
    checkins = [],
    messages = [],
    sightings = [],
    personalNotes = [],
    anonymousTips = []
) => {
    const people = new Map();
    const timeline = [];
    const locationCluster = new Map();
    const connections = new Map();

    // Parse Check-ins
    checkins.forEach((checkin) => {
        const person = checkin.answers?.[Object.keys(checkin.answers)[0]]?.answer || 'Unknown';
        const location = checkin.answers?.[Object.keys(checkin.answers)[1]]?.answer || 'Unknown';
        const timestamp = new Date(checkin.created_at);

        const personProfile = findOrCreatePerson(people, person);
        const checkInRecord = {
            person,
            location,
            timestamp,
            checkinId: checkin.id,
            notes: checkin.answers?.[Object.keys(checkin.answers)[2]]?.answer
        };

        personProfile.checkins.push(checkInRecord);
        personProfile.locations.push({
            location,
            timestamp,
            source: 'checkin'
        });

        // Update location cluster
        if (!locationCluster.has(location)) {
            locationCluster.set(location, new Set());
        }
        locationCluster.get(location).add(person);

        // Update timeline
        timeline.push({
            timestamp,
            person,
            event: `Checked in at ${location}`,
            location
        });

        personProfile.lastSeen = new Date(Math.max(personProfile.lastSeen?.getTime() || 0, timestamp.getTime()));
        personProfile.firstSeen = new Date(Math.min(personProfile.firstSeen?.getTime() || Infinity, timestamp.getTime()));
    });

    // Parse Messages
    messages.forEach((message) => {
        const sender = message.answers?.[Object.keys(message.answers)[0]]?.answer || 'Unknown';
        const recipient = message.answers?.[Object.keys(message.answers)[1]]?.answer || 'Unknown';
        const content = message.answers?.[Object.keys(message.answers)[2]]?.answer || '';
        const timestamp = new Date(message.created_at);

        // Add record for sender
        const senderProfile = findOrCreatePerson(people, sender);
        const messageRecord = {
            sender,
            recipient,
            content,
            timestamp,
            messageId: message.id
        };
        senderProfile.messages.push(messageRecord);

        // Link sender and recipient
        senderProfile.connectedPeople.add(normalizeName(recipient));
        const recipientProfile = findOrCreatePerson(people, recipient);
        recipientProfile.connectedPeople.add(normalizeName(sender));

        // Update connections graph
        if (!connections.has(normalizeName(sender))) {
            connections.set(normalizeName(sender), new Set());
        }
        connections.get(normalizeName(sender)).add(normalizeName(recipient));

        timeline.push({
            timestamp,
            person: sender,
            event: `Sent message to ${recipient}`,
            location: undefined
        });

        senderProfile.lastSeen = new Date(Math.max(senderProfile.lastSeen?.getTime() || 0, timestamp.getTime()));
        senderProfile.firstSeen = new Date(Math.min(senderProfile.firstSeen?.getTime() || Infinity, timestamp.getTime()));
    });

    // Parse Sightings
    sightings.forEach((sighting) => {
        const spottedPerson = sighting.answers?.[Object.keys(sighting.answers)[0]]?.answer || 'Unknown';
        const spottedWith = (sighting.answers?.[Object.keys(sighting.answers)[1]]?.answer || '').split(',').map((s) => s.trim());
        const location = sighting.answers?.[Object.keys(sighting.answers)[2]]?.answer || 'Unknown';
        const timestamp = new Date(sighting.created_at);
        const description = sighting.answers?.[Object.keys(sighting.answers)[3]]?.answer;

        const personProfile = findOrCreatePerson(people, spottedPerson);
        const sightingRecord = {
            spottedPerson,
            spottedWith,
            location,
            timestamp,
            description,
            sightingId: sighting.id
        };

        personProfile.sightings.asSubject.push(sightingRecord);
        personProfile.locations.push({
            location,
            timestamp,
            source: 'sighting'
        });

        // Record all people spotted with the main person
        spottedWith.forEach((person) => {
            if (person && person !== spottedPerson) {
                personProfile.connectedPeople.add(normalizeName(person));
                const otherProfile = findOrCreatePerson(people, person);
                otherProfile.connectedPeople.add(normalizeName(spottedPerson));
                otherProfile.sightings.withOthers.push(sightingRecord);
            }
        });

        // Update location cluster
        if (!locationCluster.has(location)) {
            locationCluster.set(location, new Set());
        }
        locationCluster.get(location).add(spottedPerson);
        spottedWith.forEach((person) => {
            if (person) {
                locationCluster.get(location).add(person);
            }
        });

        timeline.push({
            timestamp,
            person: spottedPerson,
            event: `Spotted with ${spottedWith.join(', ')} at ${location}`,
            location
        });

        personProfile.lastSeen = new Date(Math.max(personProfile.lastSeen?.getTime() || 0, timestamp.getTime()));
        personProfile.firstSeen = new Date(Math.min(personProfile.firstSeen?.getTime() || Infinity, timestamp.getTime()));
    });

    // Parse Personal Notes
    personalNotes.forEach((note) => {
        const author = note.answers?.[Object.keys(note.answers)[0]]?.answer || 'Unknown';
        const content = note.answers?.[Object.keys(note.answers)[1]]?.answer || '';
        const timestamp = new Date(note.created_at);

        const personProfile = findOrCreatePerson(people, author);
        const noteRecord = {
            author,
            content,
            timestamp,
            noteId: note.id
        };
        personProfile.notes.push(noteRecord);

        timeline.push({
            timestamp,
            person: author,
            event: `Added personal note`,
            location: undefined
        });

        personProfile.lastSeen = new Date(Math.max(personProfile.lastSeen?.getTime() || 0, timestamp.getTime()));
        personProfile.firstSeen = new Date(Math.min(personProfile.firstSeen?.getTime() || Infinity, timestamp.getTime()));
    });

    // Parse Anonymous Tips
    anonymousTips.forEach((tip) => {
        const content = tip.answers?.[Object.keys(tip.answers)[0]]?.answer || '';
        const location = tip.answers?.[Object.keys(tip.answers)[1]]?.answer;
        const timestamp = new Date(tip.created_at);

        // Extract mentioned people from content
        const mentionedPeople = [];
        const tipRecord = {
            content,
            location,
            timestamp,
            mentionedPeople,
            tipId: tip.id
        };

        // If people are mentioned in the content, add tip to their profile
        people.forEach((profile) => {
            if (content.toLowerCase().includes(profile.name.toLowerCase())) {
                profile.tipsAbout.push(tipRecord);
                mentionedPeople.push(profile.name);
            }
        });

        timeline.push({
            timestamp,
            person: 'Anonymous',
            event: `Anonymous tip: ${content.substring(0, 50)}...`,
            location
        });
    });

    // Sort timeline
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
        people,
        timeline,
        locationCluster,
        connections,
        lastUpdated: new Date()
    };
};

/**
 * Get a chronological chain of sightings for a specific person
 * Optionally filter by location
 */
export const getChainOfSightings = (person, filterLocation) => {
    const sightings = person.sightings.asSubject
        .filter(sighting => !filterLocation || sighting.location.toLowerCase().includes(filterLocation.toLowerCase()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .map(sighting => ({
            timestamp: sighting.timestamp,
            location: sighting.location,
            spottedWith: sighting.spottedWith,
            description: sighting.description
        }));

    return {
        person: person.name,
        sightings
    };
};

/**
 * Find all people who were at the same location at similar times
 * Returns a map of connections
 */
export const findLocationBasedConnections = (data, timeWindowMinutes = 60) => {
    const connections = new Map();

    data.locationCluster.forEach((peopleSet, location) => {
        const peopleAtLocation = Array.from(peopleSet);

        peopleAtLocation.forEach((person1) => {
            const profile1 = data.people.get(normalizeName(person1));
            if (!profile1) return;

            const connectedAtLocation = new Set();

            profile1.locations.forEach((loc1) => {
                if (loc1.location.toLowerCase() === location.toLowerCase()) {
                    peopleAtLocation.forEach((person2) => {
                        if (person1 === person2) return;

                        const profile2 = data.people.get(normalizeName(person2));
                        if (!profile2) return;

                        profile2.locations.forEach((loc2) => {
                            if (loc2.location.toLowerCase() === location.toLowerCase()) {
                                const timeDiff = Math.abs(loc1.timestamp.getTime() - loc2.timestamp.getTime());
                                if (timeDiff <= timeWindowMinutes * 60 * 1000) {
                                    connectedAtLocation.add(person2);
                                }
                            }
                        });
                    });
                }
            });

            if (connectedAtLocation.size > 0) {
                const key = normalizeName(person1);
                connections.set(key, Array.from(connectedAtLocation));
            }
        });
    });

    return connections;
};

/**
 * Export investigation data to JSON
 */
export const exportInvestigationData = (data) => {
    return {
        people: Array.from(data.people.entries()).map(([key, profile]) => ({
            normalizedName: key,
            name: profile.name,
            aliases: Array.from(profile.aliases),
            locationsCount: profile.locations.length,
            messagesCount: profile.messages.length,
            sightingsAsSubject: profile.sightings.asSubject.length,
            checkinsCount: profile.checkins.length,
            connectedPeople: Array.from(profile.connectedPeople),
            firstSeen: profile.firstSeen,
            lastSeen: profile.lastSeen
        })),
        timelineCount: data.timeline.length,
        locationCount: data.locationCluster.size,
        lastUpdated: data.lastUpdated
    };
};
