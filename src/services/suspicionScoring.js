import { normalizeName } from './dataNormalization';

const DIRECT_SIGHTING_POINTS = 50;
const PROXIMITY_POINTS = 30;
const KEYWORD_POINTS = 10;
const TIP_POINTS = 15;
const TIP_RELIABILITY_MULTIPLIER = 0.5;
const PROXIMITY_WINDOW_MS = 60 * 60 * 1000;

const SUSPICIOUS_KEYWORDS = ['trap', 'secret', 'disappear', 'money', 'plan'];

const normalizeText = (value) =>
    String(value || '')
        .toLocaleLowerCase('tr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, ' ')
        .trim();

const countOccurrences = (text, keyword) => {
    if (!text || !keyword) return 0;
    let count = 0;
    let cursor = 0;

    while (true) {
        const foundAt = text.indexOf(keyword, cursor);
        if (foundAt === -1) break;
        count += 1;
        cursor = foundAt + keyword.length;
    }

    return count;
};

const roundScore = (value) => Math.round(value * 10) / 10;

export const getPodoLastKnownWhereabouts = (podoPerson) => {
    if (!podoPerson) return null;

    const movementEvents = [
        ...(podoPerson.checkins || []).map((checkin) => ({
            location: normalizeText(checkin.location),
            timestampMs: checkin.timestampMs || 0
        })),
        ...(podoPerson.sightings?.asSubject || []).map((sighting) => ({
            location: normalizeText(sighting.location),
            timestampMs: sighting.timestampMs || 0
        }))
    ].filter((event) => event.location && event.timestampMs > 0);

    if (movementEvents.length === 0) return null;

    movementEvents.sort((a, b) => b.timestampMs - a.timestampMs);
    return movementEvents[0];
};

export const calculateSuspicion = (person, options = {}) => {
    const podoName = normalizeName(options.podoName || 'Podo');
    const personName = normalizeName(person.name);
    const redFlags = [];
    let score = 0;

    const addFlag = (points, reason) => {
        if (!points) return;
        score += points;
        redFlags.push({ points, reason });
    };

    const allSightings = [
        ...(person.sightings?.asSubject || []),
        ...(person.sightings?.withOthers || [])
    ];

    const podoCoSightingCount = allSightings.filter((record) => {
        const spottedPerson = normalizeName(record.spottedPerson);
        const spottedWith = (record.spottedWith || []).map((name) => normalizeName(name));

        const personAsSubjectWithPodo = spottedPerson === personName && spottedWith.includes(podoName);
        const podoAsSubjectWithPerson = spottedPerson === podoName && spottedWith.includes(personName);

        return personAsSubjectWithPodo || podoAsSubjectWithPerson;
    }).length;

    if (podoCoSightingCount > 0) {
        addFlag(
            podoCoSightingCount * DIRECT_SIGHTING_POINTS,
            `${podoCoSightingCount} direct sighting(s) alongside Podo`
        );
    }

    const podoLastKnown = options.podoLastKnownWhereabouts || null;
    if (podoLastKnown) {
        const matchingCheckins = (person.checkins || []).filter((checkin) => {
            const sameLocation = normalizeText(checkin.location) === normalizeText(podoLastKnown.location);
            const timeDiff = Math.abs((checkin.timestampMs || 0) - podoLastKnown.timestampMs);
            return sameLocation && timeDiff <= PROXIMITY_WINDOW_MS;
        }).length;

        if (matchingCheckins > 0) {
            addFlag(
                matchingCheckins * PROXIMITY_POINTS,
                `${matchingCheckins} check-in(s) near Podo's last known location/time`
            );
        }
    }

    const textCorpus = [
        ...(person.messages || []).map((message) => normalizeText(message.content)),
        ...(person.notes || []).map((note) => normalizeText(note.content))
    ].join(' ');

    const totalKeywordHits = SUSPICIOUS_KEYWORDS.reduce((sum, keyword) => {
        return sum + countOccurrences(textCorpus, normalizeText(keyword));
    }, 0);

    if (totalKeywordHits > 0) {
        addFlag(
            totalKeywordHits * KEYWORD_POINTS,
            `${totalKeywordHits} suspicious keyword occurrence(s) in messages/notes`
        );
    }

    const tipMentions = (person.tipsAbout || []).length;
    if (tipMentions > 0) {
        const tipPoints = tipMentions * TIP_POINTS * TIP_RELIABILITY_MULTIPLIER;
        addFlag(
            tipPoints,
            `${tipMentions} anonymous tip mention(s) (x${TIP_RELIABILITY_MULTIPLIER} reliability)`
        );
    }

    return {
        suspicionScore: roundScore(score),
        redFlags
    };
};
