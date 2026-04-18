import { useState, useEffect } from 'react';
import './App.css';
import InvestigationDashboard from './components/InvestigationDashboard';
import RawSubmissionsDashboard from './components/RawSubmissionsDashboard';
import { getAllFormSubmissions } from './services/jotformService';

function App() {
  const [allData, setAllData] = useState({
    checkins: [],
    messages: [],
    sightings: [],
    personalNotes: [],
    anonymousTips: []
  });
  const [activeTab, setActiveTab] = useState('submissions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const data = await getAllFormSubmissions();
        setAllData({
          checkins: data.checkins || [],
          messages: data.messages || [],
          sightings: data.sightings || [],
          personalNotes: data.personalNotes || [],
          anonymousTips: data.anonymousTips || []
        });
      } catch (error) {
        console.error('Error fetching all data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Jotform Data Dashboard</h1>
          <p>Loading investigation data...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Investigation Dashboard</h1>
        <p>Jotform Data Analysis & Record Linking System</p>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          📋 Raw Submissions
        </button>
        <button
          className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          🔬 Intelligence Analysis
        </button>
      </div>

      <main className="App-main">
        {activeTab === 'analysis' && (
          <InvestigationDashboard
            checkins={allData.checkins}
            messages={allData.messages}
            sightings={allData.sightings}
            personalNotes={allData.personalNotes}
            anonymousTips={allData.anonymousTips}
          />
        )}

        {activeTab === 'submissions' && (
          <RawSubmissionsDashboard />
        )}


      </main>
    </div>
  );
}

export default App;
