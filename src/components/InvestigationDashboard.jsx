import React, { useState, useEffect } from 'react';
import {
    normalizeFormData,
    getChainOfSightings,
    findLocationBasedConnections,
    exportInvestigationData
} from '../services/dataNormalization';
import './InvestigationDashboard.css';

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

                        {selectedPerson.sightings.asSubject.length > 0 && (
                            <div className="detail-section">
                                <h4>👁️ Chain of Sightings</h4>
                                <div className="location-filter">
                                    <input
                                        type="text"
                                        placeholder="Filter by location (e.g., Kızılay, Bahçelievler)"
                                        value={filterLocation}
                                        onChange={(e) => setFilterLocation(e.target.value)}
                                    />
                                </div>
                                <div className="sightings-timeline">
                                    {getChainOfSightings(selectedPerson, filterLocation).sightings.map((sighting, idx) => (
                                        <div key={idx} className="timeline-item">
                                            <div className="timeline-marker">
                                                <span className="timeline-dot"></span>
                                            </div>
                                            <div className="timeline-content">
                                                <p className="timeline-time">{sighting.timestamp.toLocaleString()}</p>
                                                <p className="timeline-location">📍 {sighting.location}</p>
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
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedPerson.checkins.length > 0 && (
                            <div className="detail-section">
                                <h4>📍 Check-ins</h4>
                                <div className="items-list">
                                    {selectedPerson.checkins.map((checkin) => (
                                        <div key={checkin.checkinId} className="list-item">
                                            <span className="timestamp">{checkin.timestamp.toLocaleString()}</span>
                                            <span className="content">{checkin.location}</span>
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
