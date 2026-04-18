import React, { useState, useEffect } from 'react';
import { getFormData } from '../services/jotformService';
import { formatJotformDate } from '../utils/dateTime';
import './FormSubmissions.css';

const FormSubmissions = ({ formName, displayName }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await getFormData(formName);
                setSubmissions(data.submissions);
                setError(null);
            } catch (err) {
                setError(err.message || 'Failed to fetch submissions');
                setSubmissions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [formName]);

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (loading) {
        return <div className="form-section loading">Loading {displayName}...</div>;
    }

    if (error) {
        return <div className="form-section error">Error: {error}</div>;
    }

    return (
        <div className="form-section">
            <h2>{displayName}</h2>
            <p className="submission-count">Total submissions: {submissions.length}</p>

            {submissions.length === 0 ? (
                <p className="no-submissions">No submissions found</p>
            ) : (
                <div className="submissions-list">
                    {submissions.map((submission) => (
                        <div key={submission.id} className="submission-item">
                            <div
                                className="submission-header"
                                onClick={() => toggleExpand(submission.id)}
                            >
                                <h3>Submission #{submission.id}</h3>
                                <span className="expand-icon">
                                    {expandedId === submission.id ? '▼' : '▶'}
                                </span>
                            </div>

                            {expandedId === submission.id && (
                                <div className="submission-content">
                                    <p className="submission-date">
                                        Date: {formatJotformDate(submission.created_at)}
                                    </p>
                                    <div className="submission-answers">
                                        {Object.entries(submission.answers).map((answer) => (
                                            <div key={answer[0]} className="answer-item">
                                                <strong>{answer[1].prettyText || answer[1].text || 'Answer'}:</strong>
                                                <p>{answer[1].answer || 'N/A'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FormSubmissions;
