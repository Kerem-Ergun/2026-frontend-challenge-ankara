import React from 'react';
import './SuspicionDashboard.css';

const getRiskLevel = (score) => {
    if (score >= 80) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
};

const SuspicionMeter = ({ score = 0 }) => {
    const normalizedWidth = Math.min((score / 120) * 100, 100);
    const riskLevel = getRiskLevel(score);

    return (
        <div className="suspicion-meter">
            <div className="meter-header">
                <span>Suspicion Score</span>
                <strong>{score}</strong>
            </div>
            <div className="meter-track">
                <div
                    className={`meter-fill ${riskLevel}`}
                    style={{ width: `${normalizedWidth}%` }}
                />
            </div>
            <p className={`meter-label ${riskLevel}`}>
                {riskLevel === 'high' ? 'High / Guilty' : riskLevel === 'medium' ? 'Medium' : 'Low'}
            </p>
        </div>
    );
};

export default SuspicionMeter;
