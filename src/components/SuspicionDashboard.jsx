import React, { useEffect, useMemo, useState } from 'react';
import { normalizeFormData, normalizeName } from '../services/dataNormalization';
import { calculateSuspicion, getPodoLastKnownWhereabouts } from '../services/suspicionScoring';
import SuspicionMeter from './SuspicionMeter';
import './SuspicionDashboard.css';

const getRiskLevel = (score) => {
    if (score >= 80) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
};

const SuspicionDashboard = ({
    checkins = [],
    messages = [],
    sightings = [],
    personalNotes = [],
    anonymousTips = []
}) => {
    const [investigationData, setInvestigationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPersonKey, setSelectedPersonKey] = useState(null);

    useEffect(() => {
        try {
            setLoading(true);
            const data = normalizeFormData(checkins, messages, sightings, personalNotes, anonymousTips);
            setInvestigationData(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to calculate suspicion data');
        } finally {
            setLoading(false);
        }
    }, [checkins, messages, sightings, personalNotes, anonymousTips]);

    const rankedSuspects = useMemo(() => {
        if (!investigationData) return [];

        const people = Array.from(investigationData.people.values());
        const podo = people.find((person) => normalizeName(person.name) === 'podo') || null;
        const podoLastKnownWhereabouts = getPodoLastKnownWhereabouts(podo);

        return people
            .filter((person) => normalizeName(person.name) !== 'podo')
            .map((person) => {
                const result = calculateSuspicion(person, { podoLastKnownWhereabouts, podoName: 'Podo' });
                return {
                    key: person.normalizedName,
                    person,
                    suspicionScore: result.suspicionScore,
                    redFlags: result.redFlags,
                    riskLevel: getRiskLevel(result.suspicionScore)
                };
            })
            .sort((a, b) => b.suspicionScore - a.suspicionScore);
    }, [investigationData]);

    useEffect(() => {
        if (rankedSuspects.length === 0) {
            setSelectedPersonKey(null);
            return;
        }

        if (!selectedPersonKey || !rankedSuspects.some((item) => item.key === selectedPersonKey)) {
            setSelectedPersonKey(rankedSuspects[0].key);
        }
    }, [rankedSuspects, selectedPersonKey]);

    const selectedSuspect = rankedSuspects.find((item) => item.key === selectedPersonKey) || null;

    if (loading) {
        return <div className="suspicion-dashboard">Calculating suspicion scores...</div>;
    }

    if (error) {
        return <div className="suspicion-dashboard">Error: {error}</div>;
    }

    return (
        <div className="suspicion-dashboard">
            <h2>🚨 Suspicion Scoring Dashboard</h2>

            <div className="suspicion-layout">
                <div className="suspect-list">
                    <h3>Ranked Suspects (Highest First)</h3>
                    <div className="suspect-grid">
                        {rankedSuspects.map((suspect) => (
                            <div
                                key={suspect.key}
                                className={`suspect-card ${selectedPersonKey === suspect.key ? 'active' : ''}`}
                                onClick={() => setSelectedPersonKey(suspect.key)}
                            >
                                <div className="suspect-top">
                                    <p className="suspect-name">{suspect.person.name}</p>
                                    <span className={`suspect-score ${suspect.riskLevel}`}>
                                        {suspect.suspicionScore}
                                    </span>
                                </div>
                                <p className="suspect-sub">
                                    {suspect.redFlags.length} red flag(s) • {suspect.person.connectedPeople.size} connection(s)
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="suspect-details">
                    {selectedSuspect ? (
                        <>
                            <h3>{selectedSuspect.person.name}</h3>
                            <SuspicionMeter score={selectedSuspect.suspicionScore} />

                            <h4>Red Flags</h4>
                            {selectedSuspect.redFlags.length === 0 ? (
                                <p className="no-red-flags">No red flags found based on current rules.</p>
                            ) : (
                                <ul className="red-flag-list">
                                    {selectedSuspect.redFlags.map((flag, idx) => (
                                        <li key={`${selectedSuspect.key}-${idx}`}>
                                            <span className="red-flag-points">+{flag.points}</span> {flag.reason}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    ) : (
                        <p className="no-red-flags">No suspects available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuspicionDashboard;
