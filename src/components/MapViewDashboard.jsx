import React, { useState, useEffect } from 'react';
import { normalizeFormData, normalizeName } from '../services/dataNormalization';
import { formatJotformDate, getJotformTimestampMs } from '../utils/dateTime';
import MapDashboard from './MapDashboard';
import './InvestigationDashboard.css';

const normalizeSearchText = (value) =>
    String(value || '')
        .toLocaleLowerCase('tr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, ' ')
        .trim();

const extractAnswerText = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map((item) => extractAnswerText(item)).filter(Boolean).join(', ');
    if (typeof value === 'object') {
        const preferredKeys = ['prettyFormat', 'fullName', 'addr_line1', 'city', 'state', 'country'];
        const preferredValues = preferredKeys
            .map((key) => value[key])
            .filter((item) => item !== null && item !== undefined && String(item).trim() !== '');

        if (preferredValues.length > 0) {
            return preferredValues.map((item) => String(item)).join(' ');
        }

        return Object.values(value).map((item) => extractAnswerText(item)).filter(Boolean).join(' ');
    }

    return '';
};

const getAnswerByKeywords = (answers, keywords, fallbackIndex = 0) => {
    const answerList = Object.values(answers || {});
    const normalizedKeywords = keywords.map((keyword) => normalizeSearchText(keyword));

    const matched = answerList.find((answer) => {
        const searchable = normalizeSearchText(`${answer?.text || ''} ${answer?.name || ''} ${answer?.prettyText || ''}`);
        return normalizedKeywords.some((keyword) => searchable.includes(keyword));
    });

    return extractAnswerText(matched?.answer ?? answerList[fallbackIndex]?.answer);
};

const getTimestampFromAnswers = (answers) => {
    const answerList = Object.values(answers || {});
    const timestampAnswer = answerList.find((answer) => {
        const searchable = normalizeSearchText(`${answer?.text || ''} ${answer?.name || ''} ${answer?.prettyText || ''}`);
        return searchable.includes('timestamp') || searchable.includes('tarih') || searchable.includes('saat');
    });

    return timestampAnswer?.answer ? extractAnswerText(timestampAnswer.answer) : null;
};

const parseCoordinates = (rawValue) => {
    const text = String(rawValue || '').trim();
    if (!text) return null;

    const parts = text
        .split(/[,;\s]+/)
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item));

    if (parts.length < 2) return null;

    const [first, second] = parts;
    const isLatLng = Math.abs(first) <= 90 && Math.abs(second) <= 180;
    if (isLatLng) return { lat: first, lng: second };

    const isLngLat = Math.abs(first) <= 180 && Math.abs(second) <= 90;
    if (isLngLat) return { lat: second, lng: first };

    return null;
};

const getCoordinatesFromAnswers = (answers) => {
    const rawCoordinates = getAnswerByKeywords(
        answers,
        ['coordinates', 'coord', 'latitude', 'longitude', 'koordinat', 'konum'],
        0
    );

    return parseCoordinates(rawCoordinates);
};

const mapRawSighting = (submission) => {
    const answers = submission?.answers || {};
    const spottedPerson = getAnswerByKeywords(answers, ['spotted person', 'who', 'kim', 'person'], 0);
    const spottedWithRaw = getAnswerByKeywords(answers, ['spotted with', 'with', 'beraber', 'yanında', 'yaninda'], 1);
    const location = getAnswerByKeywords(answers, ['location', 'where', 'nerede', 'konum', 'mekan', 'mekân'], 2);
    const description = getAnswerByKeywords(answers, ['description', 'details', 'açıklama', 'aciklama', 'note'], 3);
    const coordinates = getCoordinatesFromAnswers(answers);
    const timestampRaw = getTimestampFromAnswers(answers) || submission?.created_at;

    return {
        id: `sighting-${submission?.id}`,
        type: 'sighting',
        spottedPerson,
        spottedWith: spottedWithRaw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        location,
        description,
        timestampRaw,
        timestampMs: getJotformTimestampMs(timestampRaw),
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        hasValidCoordinates: Boolean(coordinates)
    };
};

const mapRawCheckin = (submission) => {
    const answers = submission?.answers || {};
    const person = getAnswerByKeywords(answers, ['person', 'name', 'who', 'kim', 'kişi'], 0);
    const location = getAnswerByKeywords(answers, ['location', 'where', 'nerede', 'konum', 'mekan', 'mekân'], 1);
    const note = getAnswerByKeywords(answers, ['note', 'notes', 'açıklama', 'aciklama', 'not'], 2);
    const coordinates = getCoordinatesFromAnswers(answers);
    const timestampRaw = getTimestampFromAnswers(answers) || submission?.created_at;

    return {
        id: `checkin-${submission?.id}`,
        type: 'checkin',
        person,
        location,
        note,
        timestampRaw,
        timestampMs: getJotformTimestampMs(timestampRaw),
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        hasValidCoordinates: Boolean(coordinates)
    };
};

const MapViewDashboard = ({
    checkins = [],
    messages = [],
    sightings = [],
    personalNotes = [],
    anonymousTips = []
}) => {
    const [investigationData, setInvestigationData] = useState(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [filterLocation, setFilterLocation] = useState('');
    const [activeMapEventId, setActiveMapEventId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            setLoading(true);
            const data = normalizeFormData(checkins, messages, sightings, personalNotes, anonymousTips);
            setInvestigationData(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to normalize data');
        } finally {
            setLoading(false);
        }
    }, [checkins, messages, sightings, personalNotes, anonymousTips]);

    useEffect(() => {
        setFilterLocation('');
        setActiveMapEventId(null);
    }, [selectedPerson?.normalizedName]);

    if (loading) {
        return <div className="investigation-dashboard loading">Loading map data...</div>;
    }

    if (error) {
        return <div className="investigation-dashboard error">Error: {error}</div>;
    }

    if (!investigationData) {
        return <div className="investigation-dashboard">No data available</div>;
    }

    const people = Array.from(investigationData.people.values()).sort(
        (a, b) => (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0)
    );

    const movementTimeline = selectedPerson
        ? (() => {
            const personNames = new Set(
                [selectedPerson.name, ...Array.from(selectedPerson.aliases || [])]
                    .map((name) => normalizeName(name))
                    .filter(Boolean)
            );

            const normalizedFilter = normalizeSearchText(filterLocation);

            const sightingEvents = (sightings || [])
                .map((submission) => mapRawSighting(submission))
                .filter((item) => personNames.has(normalizeName(item.spottedPerson)));

            const checkinEvents = (checkins || [])
                .map((submission) => mapRawCheckin(submission))
                .filter((item) => personNames.has(normalizeName(item.person)));

            return [...sightingEvents, ...checkinEvents]
                .filter((item) => {
                    if (!normalizedFilter) return true;
                    const normalizedLocation = normalizeSearchText(item.location);
                    if (normalizedLocation.includes(normalizedFilter)) return true;
                    const tokens = normalizedFilter.split(' ').filter(Boolean);
                    return tokens.every((token) => normalizedLocation.includes(token));
                })
                .sort((a, b) => a.timestampMs - b.timestampMs);
        })()
        : [];

    const mapEvents = movementTimeline.filter((event) => event.hasValidCoordinates);
    const skippedCoordinateCount = movementTimeline.length - mapEvents.length;
    const effectiveActiveMapEventId =
        mapEvents.find((event) => event.id === activeMapEventId)?.id || mapEvents[0]?.id || null;
    const activeMapEvent = mapEvents.find((event) => event.id === effectiveActiveMapEventId) || null;

    return (
        <div className="investigation-dashboard">
            <h2>🗺️ Map View Dashboard</h2>

            <div className="dashboard-content">
                <div className="people-list">
                    <h3>People of Interest</h3>
                    <div className="people-grid">
                        {people.map((person) => (
                            <div
                                key={person.normalizedName}
                                className={`person-card ${selectedPerson?.normalizedName === person.normalizedName ? 'selected' : ''}`}
                                onClick={() => setSelectedPerson(person)}
                            >
                                <h4>{person.name}</h4>
                                <div className="person-stats">
                                    <span>📍 {person.locations.length} locations</span>
                                    <span>👁️ {person.sightings.asSubject.length} sightings</span>
                                    <span>🧭 {person.checkins.length} check-ins</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedPerson && (
                    <div className="person-details">
                        <h3>Movement: {selectedPerson.name}</h3>

                        <div className="detail-section">
                            <h4>Filter</h4>
                            <div className="location-filter">
                                <input
                                    type="text"
                                    placeholder="Filter by location (e.g., Kızılay, Bahçelievler)"
                                    value={filterLocation}
                                    onChange={(e) => setFilterLocation(e.target.value.trimStart())}
                                />
                            </div>

                            {mapEvents.length > 0 ? (
                                <MapDashboard
                                    events={mapEvents}
                                    selectedEventId={activeMapEvent?.id || null}
                                    onMarkerSelect={(eventId) => setActiveMapEventId(eventId)}
                                />
                            ) : (
                                <p className="map-empty-state">
                                    No valid map coordinates found for this suspect in the selected filter.
                                </p>
                            )}

                            {skippedCoordinateCount > 0 && (
                                <p className="map-warning">
                                    {skippedCoordinateCount} record(s) skipped because coordinates are missing or malformed.
                                </p>
                            )}
                        </div>

                        <div className="detail-section">
                            <h4>Chronological Movement</h4>
                            <div className="sightings-timeline">
                                {movementTimeline.length === 0 ? (
                                    <p className="timeline-description">No movement events match this location filter.</p>
                                ) : (
                                    movementTimeline.map((event, idx) => (
                                        <div
                                            key={event.id || idx}
                                            className={`timeline-item ${activeMapEvent?.id === event.id ? 'active' : ''} ${event.hasValidCoordinates ? 'clickable' : ''}`}
                                            onClick={() => {
                                                if (event.hasValidCoordinates) {
                                                    setActiveMapEventId(event.id);
                                                }
                                            }}
                                        >
                                            <div className="timeline-marker">
                                                <span className="timeline-dot"></span>
                                            </div>
                                            <div className="timeline-content">
                                                <p className="timeline-time">{formatJotformDate(event.timestampRaw)}</p>
                                                <p className="timeline-type">
                                                    {event.type === 'sighting' ? '👁️ Sighting' : '📍 Check-in'}
                                                </p>
                                                <p className="timeline-location">📍 {event.location || 'Unknown'}</p>
                                                {event.type === 'sighting' && event.spottedWith.length > 0 && (
                                                    <p className="timeline-with">👥 With: {event.spottedWith.join(', ')}</p>
                                                )}
                                                {event.type === 'checkin' && event.note && (
                                                    <p className="timeline-description">{event.note}</p>
                                                )}
                                                {event.type === 'sighting' && event.description && (
                                                    <p className="timeline-description">{event.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapViewDashboard;
