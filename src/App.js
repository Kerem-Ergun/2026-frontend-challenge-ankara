import './App.css';
import FormSubmissions from './components/FormSubmissions';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Jotform Data Dashboard</h1>
        <p>View submissions from all forms</p>
      </header>

      <main className="App-main">
        <FormSubmissions formName="checkins" displayName="📍 Checkins" />
        <FormSubmissions formName="messages" displayName="💬 Messages" />
        <FormSubmissions formName="sightings" displayName="👁️ Sightings" />
        <FormSubmissions formName="personalNotes" displayName="📝 Personal Notes" />
        <FormSubmissions formName="anonymousTips" displayName="🕵️ Anonymous Tips" />
      </main>
    </div>
  );
}

export default App;
