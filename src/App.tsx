import { useState, useEffect } from 'react';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import { exchangeToken, refreshStravaToken } from './api/strava';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('strava_access_token'));
  const [isDemo, setIsDemo] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Silent token refresh check
    const expiresAt = localStorage.getItem('strava_expires_at');
    const refreshToken = localStorage.getItem('strava_refresh_token');
    
    if (token && expiresAt && refreshToken) {
       if (Date.now() / 1000 > Number(expiresAt)) {
          refreshStravaToken(refreshToken)
            .then(data => {
               localStorage.setItem('strava_access_token', data.access_token);
               localStorage.setItem('strava_refresh_token', data.refresh_token);
               localStorage.setItem('strava_expires_at', data.expires_at.toString());
               setToken(data.access_token);
            })
            .catch(() => {
               // Token completely revoked or failed, force logout
               localStorage.removeItem('strava_access_token');
               setToken(null);
            });
       }
    }

    // 2. Initial OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !token) {
      setAuthenticating(true);
      exchangeToken(code)
        .then((data) => {
          localStorage.setItem('strava_access_token', data.access_token);
          if (data.refresh_token) localStorage.setItem('strava_refresh_token', data.refresh_token);
          if (data.expires_at) localStorage.setItem('strava_expires_at', data.expires_at.toString());
          
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setToken(data.access_token);
        })
        .catch((err) => {
          console.error(err);
          setError('Failed to authenticate with Strava.');
        })
        .finally(() => {
          setAuthenticating(false);
        });
    }
  }, [token]);

  if (authenticating) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="animate-fade-in text-gradient">Authenticating with Strava...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="glass-panel animate-fade-in" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Oops!</h2>
          <p>{error}</p>
          <button className="btn" style={{ marginTop: '1rem' }} onClick={() => { setError(null); window.location.href = '/'; }}>Try Again</button>
        </div>
      </div>
    );
  }

  if (!token && !isDemo) {
    return <Home onOpenDemo={() => setIsDemo(true)} />;
  }

  return (
    <Dashboard 
      token={token} 
      isDemo={isDemo}
      onLogout={() => {
        localStorage.removeItem('strava_access_token');
        localStorage.removeItem('strava_refresh_token');
        localStorage.removeItem('strava_expires_at');
        setToken(null);
        setIsDemo(false);
      }} 
    />
  );
}

export default App;
