import { useState } from 'react';
import FormSubmissions from './FormSubmissions';

const FORM_TABS = [
    { key: 'checkins', label: '📍 Checkins' },
    { key: 'messages', label: '💬 Messages' },
    { key: 'sightings', label: '👁️ Sightings' },
    { key: 'personalNotes', label: '📝 Personal Notes' },
    { key: 'anonymousTips', label: '🕵️ Anonymous Tips' }
];

function RawSubmissionsDashboard() {
    const [activeFormTab, setActiveFormTab] = useState('checkins');

    const activeForm = FORM_TABS.find((tab) => tab.key === activeFormTab) || FORM_TABS[0];

    return (
        <section className="raw-submissions-dashboard">
            <div className="sub-tab-navigation">
                {FORM_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        className={`sub-tab-btn ${activeFormTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveFormTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <FormSubmissions formName={activeForm.key} displayName={activeForm.label} />
        </section>
    );
}

export default RawSubmissionsDashboard;