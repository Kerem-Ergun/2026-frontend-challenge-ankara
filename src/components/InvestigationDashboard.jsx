import React, { useState, useEffect } from 'react';
import {
    normalizeFormData,
    normalizeName
} from '../services/dataNormalization';
import { formatJotformDate, getJotformTimestampMs } from '../utils/dateTime';
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

const mapRawSighting = (submission) => {
    const answers = submission?.answers || {};
    const spottedPerson = getAnswerByKeywords(answers, ['spotted person', 'who', 'kim', 'person'], 0);
    const spottedWithRaw = getAnswerByKeywords(answers, ['spotted with', 'with', 'beraber', 'yanında', 'yaninda'], 1);
    const location = getAnswerByKeywords(answers, ['location', 'where', 'nerede', 'konum', 'mekan', 'mekân'], 2);
    const description = getAnswerByKeywords(answers, ['description', 'details', 'açıklama', 'aciklama', 'note'], 3);

    // Extract timestamp from form answers (look for "Timestamp" field)
    const answerList = Object.values(answers || {});
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

    const formTimestampRaw = timestampAnswer?.answer ? extractAnswerText(timestampAnswer.answer) : null;
    const createdAtRaw = formTimestampRaw || submission?.created_at;

    return {
        id: submission?.id,
        spottedPerson,
        spottedWith: spottedWithRaw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        location,
        description,
        createdAtRaw,
        timestampMs: getJotformTimestampMs(createdAtRaw)
    };
};

const InvestigationDashboard = ({
    checkins = [],
    messages = [],
    sightings = [],
    personalNotes = [],
    anonymousTips = []
}) => {
    const [investigationData, setInvestigationData] = useState(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [filterLocation, setFilterLocation] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            setLoading(true);
            const data = normalizeFormData(
                checkins,
                messages,
                sightings,
                personalNotes,
                anonymousTips
            );
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
    }, [selectedPerson?.normalizedName]);

    if (loading) {
        return <div className="investigation-dashboard loading">Processing investigation data...</div>;
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

    const locations = Array.from(investigationData.locationCluster.keys()).sort();
    const chainOfSightings = selectedPerson
        ? (() => {
            const personNames = new Set(
                [selectedPerson.name, ...Array.from(selectedPerson.aliases || [])]
                    .map((name) => normalizeName(name))
                    .filter(Boolean)
            );

            const normalizedFilter = normalizeSearchText(filterLocation);

            return (sightings || [])
                .map((submission) => mapRawSighting(submission))
                .filter((item) => personNames.has(normalizeName(item.spottedPerson)))
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

    return (
        <div className="investigation-dashboard">
            <h2>🔍 Investigation Dashboard</h2>

            <div className="dashboard-stats">
                <div className="stat-card">
                    <h3>👥 People</h3>
                    <p className="stat-number">{people.length}</p>
                </div>
                <div className="stat-card">
                    <h3>📍 Locations</h3>
                    <p className="stat-number">{locations.length}</p>
                </div>
                <div className="stat-card">
                    <h3>📅 Timeline Events</h3>
                    <p className="stat-number">{investigationData.timeline.length}</p>
                </div>
                <div className="stat-card">
                    <h3>💬 Connections</h3>
                    <p className="stat-number">{investigationData.connections.size}</p>
                </div>
            </div>

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
                                    <span>💬 {person.messages.length} messages</span>
                                    <span>👁️ {person.sightings.asSubject.length} sightings</span>
                                </div>
                                <div className="person-connections">
                                    {Array.from(person.connectedPeople).slice(0, 3).map((conn) => (
                                        <span key={conn} className="connection-badge">{conn.split(' ')[0]}</span>
                                    ))}
                                    {person.connectedPeople.size > 3 && (
                                        <span className="connection-badge">+{person.connectedPeople.size - 3}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedPerson && (
                    <div className="person-details">
                        <h3>Profile: {selectedPerson.name}</h3>

                        <div className="detail-section">
                            <h4>📊 Summary</h4>
                            <p><strong>First Seen:</strong> {selectedPerson.firstSeen?.toLocaleString()}</p>
                            <p><strong>Last Seen:</strong> {selectedPerson.lastSeen?.toLocaleString()}</p>
                            <p><strong>Aliases:</strong> {Array.from(selectedPerson.aliases).join(', ')}</p>
                        </div>

                        <div className="detail-section">
                            <h4>👁️ Chain of Sightings</h4>
                            <div className="location-filter">
                                <input
                                    type="text"
                                    placeholder="Filter by location (e.g., Kızılay, Bahçelievler)"
                                    value={filterLocation}
                                    onChange={(e) => setFilterLocation(e.target.value.trimStart())}
                                />
                            </div>
                            <div className="sightings-timeline">
                                {chainOfSightings.length === 0 ? (
                                    <p className="timeline-description">
                                        No sightings match this location filter.
                                    </p>
                                ) : (
                                    chainOfSightings.map((sighting, idx) => (
                                        <div key={sighting.id || idx} className="timeline-item">
                                            <div className="timeline-marker">
                                                <span className="timeline-dot"></span>
                                            </div>
                                            <div className="timeline-content">
                                                <p className="timeline-time">{formatJotformDate(sighting.createdAtRaw)}</p>
                                                <p className="timeline-location">📍 {sighting.location || 'Unknown'}</p>
                                                {sighting.spottedWith.length > 0 && (
                                                    <p className="timeline-with">
                                                        👥 With: {sighting.spottedWith.join(', ')}
                                                    </p>
                                                )}
                                                {sighting.description && (
                                                    <p className="timeline-description">{sighting.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {selectedPerson.checkins.length > 0 && (
                            <div className="detail-section">
                                <h4>📍 Check-ins</h4>
                                <div className="items-list">
                                    {selectedPerson.checkins.map((checkin) => (
                                        <div key={checkin.checkinId} className="list-item">
                                            <span className="timestamp">{checkin.timestamp.toLocaleString()}</span>
                                            <span className="content">{checkin.location}</span>
                                            {checkin.notes && String(checkin.notes).trim() && (
                                                <span className="notes">{String(checkin.notes).trim()}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedPerson.messages.length > 0 && (
                            <div className="detail-section">
                                <h4>💬 Messages</h4>
                                <div className="messages-list">
                                    {selectedPerson.messages.map((msg) => (
                                        <div key={msg.messageId} className="message-item">
                                            <p className="message-time">{msg.timestamp.toLocaleString()}</p>
                                            <p className="message-to">To: {msg.recipient}</p>
                                            <p className="message-content">"{msg.content}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedPerson.notes.length > 0 && (
                            <div className="detail-section">
                                <h4>📝 Personal Notes</h4>
                                <div className="messages-list">
                                    {selectedPerson.notes.map((note) => (
                                        <div key={note.noteId} className="message-item">
                                            <p className="message-time">{note.timestamp?.toLocaleString()}</p>
                                            <p className="message-content">"{note.content}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedPerson.connectedPeople.size > 0 && (
                            <div className="detail-section">
                                <h4>🔗 Connected People</h4>
                                <div className="connected-people">
                                    {Array.from(selectedPerson.connectedPeople).map((personName) => (
                                        <button
                                            key={personName}
                                            className="person-link"
                                            onClick={() => {
                                                const person = investigationData.people.get(personName);
                                                if (person) setSelectedPerson(person);
                                            }}
                                        >
                                            {personName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InvestigationDashboard;
