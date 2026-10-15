import { getStravaAuthUrl } from '../api/strava';
import { Activity } from 'lucide-react';

export default function Login() {
  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>
          <Activity size={48} />
        </div>
        <h1 className="text-gradient" style={{ marginBottom: '0.5rem', fontSize: '2.25rem', letterSpacing: '-0.02em' }}>Watts Next</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Analyze your recent training block and discover what's next.
        </p>
        <button 
          onClick={() => { window.location.href = getStravaAuthUrl(); }} 
          className="btn" 
          style={{ width: '100%', cursor: 'pointer' }}
        >
          Connect with Strava
        </button>
      </div>
    </div>
  );
}
