/**
 * Data Normalization Utility for Investigation Dashboard
 * Aggregates data from multiple Jotform submissions and creates a master record by person
 */

import { getJotformTimestampMs, parseJotformDate } from '../utils/dateTime';

/**
 * Normalize a person's name for matching
 * Handles different spellings, case sensitivity, extra spaces
 */
export const normalizeName = (name) => {
    if (!name) return '';
    return String(name)
        .toLocaleLowerCase('tr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const toSafeText = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.join(' ');
    return JSON.stringify(value);
};

const normalizeSearchText = (value) =>
    toSafeText(value)
        .toLocaleLowerCase('tr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, ' ')
        .trim();

const extractAnswerText = (answerValue) => {
    if (answerValue === null || answerValue === undefined) return '';
    if (typeof answerValue === 'string' || typeof answerValue === 'number' || typeof answerValue === 'boolean') {
        return String(answerValue);
    }
    if (Array.isArray(answerValue)) {
        return answerValue.map((item) => extractAnswerText(item)).filter(Boolean).join(', ');
    }
    if (typeof answerValue === 'object') {
        const preferredKeys = ['prettyFormat', 'fullName', 'addr_line1', 'city', 'state', 'country'];
        const preferredValues = preferredKeys
            .map((key) => answerValue[key])
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');

        if (preferredValues.length > 0) {
            return preferredValues.map((value) => String(value)).join(' ');
        }

        return Object.values(answerValue)
            .map((value) => extractAnswerText(value))
            .filter(Boolean)
            .join(' ');
    }

    return '';
};

const getAnswerValueByKeywords = (answers, keywords, fallbackIndex = 0) => {
    if (!answers || typeof answers !== 'object') return '';

    const answerList = Object.values(answers);
    const lowerKeywords = keywords.map((keyword) => normalizeSearchText(keyword));

    const matchedAnswer = answerList.find((answer) => {
        const searchable = normalizeSearchText(`${answer?.text || ''} ${answer?.name || ''} ${answer?.prettyText || ''}`);
        return lowerKeywords.some((keyword) => searchable.includes(keyword));
    });

    if (matchedAnswer) {
        return extractAnswerText(matchedAnswer.answer);
    }

    const fallbackAnswer = answerList[fallbackIndex];
    return extractAnswerText(fallbackAnswer?.answer);
};

/**
 * Extract timestamp from form answers by looking for the "Timestamp" field
 * Returns timestamp string, or null if not found
 */
const getTimestampFromAnswers = (answers) => {
    if (!answers || typeof answers !== 'object') return null;

    const answerList = Object.values(answers);

    // Look for exact "Timestamp" label match first
    const timestampAnswer = answerList.find((answer) => {
        const answerText = String(answer?.text || '').trim();
        const answerName = String(answer?.name || '').trim();
        const prettyText = String(answer?.prettyText || '').trim();

        return (
            answerText === 'Timestamp' ||
            answerName === 'Timestamp' ||
            prettyText === 'Timestamp' ||
            answerText.toLowerCase() === 'timestamp' ||
            answerName.toLowerCase() === 'timestamp' ||
            prettyText.toLowerCase() === 'timestamp'
        );
    });

    if (timestampAnswer && timestampAnswer.answer) {
        const timestampValue = extractAnswerText(timestampAnswer.answer);
        return timestampValue || null;
    }

    return null;
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
    for (const profile of people.values()) {
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
        const person = getAnswerValueByKeywords(checkin.answers, ['person', 'name', 'who', 'kim', 'kişi'], 0) || 'Unknown';
        const location = getAnswerValueByKeywords(checkin.answers, ['location', 'where', 'nerede', 'konum', 'mekan', 'mekân'], 1) || 'Unknown';
        const notes = getAnswerValueByKeywords(checkin.answers, ['note', 'notes', 'açıklama', 'aciklama', 'not'], 2) || '';

        // Try to get timestamp from form answers first, fall back to submission time
        const formTimestamp = getTimestampFromAnswers(checkin.answers);
        const rawTimestamp = formTimestamp || checkin.created_at;
        const timestampMs = getJotformTimestampMs(rawTimestamp);
        const timestamp = parseJotformDate(rawTimestamp) || new Date(0);

        const personProfile = findOrCreatePerson(people, person);
        const checkInRecord = {
            person,
            location,
            timestamp,
            timestampMs,
            createdAtRaw: rawTimestamp,
            checkinId: checkin.id,
            notes: notes || null
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
        const sender = getAnswerValueByKeywords(message.answers, ['sender', 'from', 'gönderen', 'kişi'], 0) || 'Unknown';
        const recipient = getAnswerValueByKeywords(message.answers, ['recipient', 'to', 'alan', 'alıcı'], 1) || 'Unknown';
        const content = getAnswerValueByKeywords(message.answers, ['content', 'message', 'text', 'mesaj', 'içerik'], 2) || '';

        // Try to get timestamp from form answers first, fall back to submission time
        const formTimestamp = getTimestampFromAnswers(message.answers);
        const rawTimestamp = formTimestamp || message.created_at;
        const timestampMs = getJotformTimestampMs(rawTimestamp);
        const timestamp = parseJotformDate(rawTimestamp) || new Date(0);

        // Add record for sender
        const senderProfile = findOrCreatePerson(people, sender);
        const messageRecord = {
            sender,
            recipient,
            content,
            timestamp,
            timestampMs,
            createdAtRaw: rawTimestamp,
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
        const spottedPerson = getAnswerValueByKeywords(sighting.answers, ['spotted person', 'who', 'kim', 'person'], 0) || 'Unknown';
        const spottedWithRaw = getAnswerValueByKeywords(sighting.answers, ['spotted with', 'with', 'beraber', 'yanında', 'yaninda'], 1);
        const spottedWith = toSafeText(spottedWithRaw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        const location = getAnswerValueByKeywords(sighting.answers, ['location', 'where', 'nerede', 'konum', 'mekan', 'mekân'], 2) || 'Unknown';
        const description = getAnswerValueByKeywords(sighting.answers, ['description', 'details', 'açıklama', 'aciklama', 'note'], 3);

        // Try to get timestamp from form answers first, fall back to submission time
        const formTimestamp = getTimestampFromAnswers(sighting.answers);
        const rawTimestamp = formTimestamp || sighting.created_at;
        const timestampMs = getJotformTimestampMs(rawTimestamp);
        const timestamp = parseJotformDate(rawTimestamp) || new Date(0);

        const personProfile = findOrCreatePerson(people, spottedPerson);
        const sightingRecord = {
            spottedPerson,
            spottedWith,
            location,
            timestamp,
            timestampMs,
            createdAtRaw: rawTimestamp,
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
        const author = getAnswerValueByKeywords(note.answers, ['author', 'person', 'who', 'kim', 'kişi'], 0) || 'Unknown';
        const content = getAnswerValueByKeywords(note.answers, ['content', 'note', 'notes', 'text', 'mesaj', 'içerik'], 1) || '';

        // Try to get timestamp from form answers first, fall back to submission time
        const formTimestamp = getTimestampFromAnswers(note.answers);
        const rawTimestamp = formTimestamp || note.created_at;
        const timestampMs = getJotformTimestampMs(rawTimestamp);
        const timestamp = parseJotformDate(rawTimestamp) || new Date(0);

        const personProfile = findOrCreatePerson(people, author);
        const noteRecord = {
            author,
            content,
            timestamp,
            timestampMs,
            createdAtRaw: rawTimestamp,
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
        const content = getAnswerValueByKeywords(tip.answers, ['content', 'tip', 'message', 'text', 'mesaj', 'bilgi'], 0) || '';
        const location = getAnswerValueByKeywords(tip.answers, ['location', 'where', 'nerede', 'konum', 'mekan', 'mekân'], 1) || null;

        // Try to get timestamp from form answers first, fall back to submission time
        const formTimestamp = getTimestampFromAnswers(tip.answers);
        const rawTimestamp = formTimestamp || tip.created_at;
        const timestampMs = getJotformTimestampMs(rawTimestamp);
        const timestamp = parseJotformDate(rawTimestamp) || new Date(0);

        // Extract mentioned people from content
        const mentionedPeople = [];
        const tipRecord = {
            content,
            location,
            timestamp,
            timestampMs,
            createdAtRaw: rawTimestamp,
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
    const normalizedFilter = normalizeSearchText(filterLocation);

    const sightings = person.sightings.asSubject
        .filter((sighting) => {
            if (!normalizedFilter) return true;
            const normalizedLocation = normalizeSearchText(sighting.location);
            if (!normalizedLocation) return false;

            if (normalizedLocation.includes(normalizedFilter)) return true;

            const filterTokens = normalizedFilter.split(' ').filter(Boolean);
            return filterTokens.every((token) => normalizedLocation.includes(token));
        })
        .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0))
        .map(sighting => ({
            timestamp: sighting.timestamp,
            timestampMs: sighting.timestampMs || 0,
            createdAtRaw: sighting.createdAtRaw,
            location: toSafeText(sighting.location),
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
