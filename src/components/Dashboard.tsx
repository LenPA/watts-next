import { useEffect, useState } from 'react';
import { STRAVA_AUTH_URL, getActivities, getAthlete } from '../api/strava';
import { saveActivities, getAllActivities, getLastSyncTime, setLastSyncTime } from '../lib/storage';
import { analyzeActivities, type AnalyzedData } from '../lib/analysis';
import { DEMO_ATHLETE, generateDemoActivities } from '../lib/demoData';
import { Activity, Zap, HeartPulse, RefreshCw, Calendar, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard({ 
  token, 
  isDemo = false, 
  onLogout 
}: { 
  token?: string | null; 
  isDemo?: boolean; 
  onLogout: () => void; 
}) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [athlete, setAthlete] = useState<any>(null);
  const [analysis, setAnalysis] = useState<AnalyzedData | null>(null);
  const [ftp, setFtp] = useState<number>(Number(localStorage.getItem('strava_user_ftp')) || 250);

  const syncData = async (force: boolean = false, currentFtp: number = ftp) => {
    if (isDemo) {
      setSyncing(true);
      setAthlete(DEMO_ATHLETE);
      const demoActs = generateDemoActivities();
      setAnalysis(analyzeActivities(demoActs, currentFtp));
      setSyncing(false);
      setLoading(false);
      return;
    }

    if (!token) return;

    try {
      setSyncing(true);
      const ath = await getAthlete(token);
      
      // Handle expired token without a refresh sequence
      if (ath.message === 'Authorization Error' || (ath.errors && ath.errors[0]?.field === 'access_token')) {
        console.warn('Strava access token expired. Logging out.');
        onLogout();
        return;
      }
      
      setAthlete(ath);

      let lastSync = await getLastSyncTime();
      if (force) lastSync = 0; // fetch all again (API limit warning!)
      
      // Fetch new activities from Strava
      // Note: Strava 'after' param takes seconds (epoch), JS Date gives ms.
      const newActivities = await getActivities(token, Math.floor(lastSync / 1000));
      
      if (Array.isArray(newActivities) && newActivities.length > 0) {
        await saveActivities(newActivities);
        await setLastSyncTime(Date.now());
      }

      // Read combined from IndexedDB
      const allActivities = await getAllActivities();
      const analyzed = analyzeActivities(allActivities, currentFtp);
      setAnalysis(analyzed);

    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    syncData();
  }, [token, isDemo]);

  const handleFtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setFtp(val);
    localStorage.setItem('strava_user_ftp', String(val));
    // Provide a snappy UI by re-running local analysis instantly
    if (!loading && !syncing) {
      if (isDemo) {
        setAnalysis(analyzeActivities(generateDemoActivities(), val));
      } else {
        getAllActivities().then(all => setAnalysis(analyzeActivities(all, val)));
      }
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="animate-fade-in text-gradient" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <RefreshCw className="spinner" /> Loading and Analyzing...
        </div>
      </div>
    );
  }

  const suggestionColors = {
    Endurance: 'var(--success)',
    Threshold: 'var(--warning)',
    Power: 'var(--danger)'
  };
  
  const iconMap = {
    Endurance: <HeartPulse size={32} color="white" />,
    Threshold: <Activity size={32} color="white" />,
    Power: <Zap size={32} color="white" />
  };

  const suggestions = analysis?.suggestions || [];

  // Group activities by week for a Weekly Timeline Stacked Bar Chart
  const weeklyDataMap = new Map();
  
  [...(analysis?.recentTrends || [])].reverse().forEach(act => {
    const d = new Date(act.start_date);
    // Get the Monday of this week
    const day = d.getDay() || 7; 
    d.setDate(d.getDate() - day + 1);
    
    // Format label: "Week of M/D"
    const weekLabel = `Week of ${d.getMonth() + 1}/${d.getDate()}`;
    
    if (!weeklyDataMap.has(weekLabel)) {
      weeklyDataMap.set(weekLabel, { week: weekLabel, Endurance: 0, Threshold: 0, Power: 0 });
    }
    
    const weekData = weeklyDataMap.get(weekLabel);
    weekData[act.analyzedType] += Math.round(act.analyzedLoad);
  });

  const weeklyChartData = Array.from(weeklyDataMap.values());

  const recentFive = analysis?.recentTrends.slice(0, 5) || [];

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      {isDemo && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(252, 76, 2, 0.15), rgba(249, 115, 22, 0.15))',
          border: '1px solid rgba(252, 76, 2, 0.3)',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ 
              background: 'var(--accent-primary)', 
              color: 'white', 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              padding: '0.2rem 0.5rem', 
              borderRadius: '4px', 
              textTransform: 'uppercase' 
            }}>
              Demo Modus
            </span>
            <span style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>
              Je bekijkt nu een interactieve preview met voorbeeld-ritten.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              onClick={onLogout} 
              className="btn-glass" 
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <ArrowLeft size={14} /> Terug naar Home
            </button>
            <a 
              href={STRAVA_AUTH_URL} 
              className="btn" 
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              Koppel jouw eigen Strava
            </a>
          </div>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            <Zap size={14} /> Watts Next
          </div>
          <h1 className="text-gradient" style={{ fontSize: '2rem' }}>Hello, {athlete?.firstname}</h1>
          <p style={{ color: 'var(--text-muted)' }}>Here is your recent training breakdown.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-glass)', padding: '0.25rem 0.5rem 0.25rem 1rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your FTP:</span>
            <input 
              type="number" 
              value={ftp}
              onChange={handleFtpChange}
              style={{ width: '70px', background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '1.2rem', fontWeight: 'bold', outline: 'none' }}
              min={50}
              max={500}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginRight: '0.5rem' }}>W</span>
          </div>

          <button className="btn" onClick={() => syncData()} disabled={syncing} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-soft)' }}>
            <RefreshCw size={16} className={syncing ? 'spinner' : ''} /> {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button className="btn" onClick={onLogout} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            {isDemo ? 'Sluit Demo' : 'Logout'}
          </button>
        </div>
      </header>

      {/* Hero Suggestion Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {suggestions.map((sug, index) => {
          const tColor = suggestionColors[sug.type];
          return (
            <div key={index} className="glass-panel" style={{ 
              borderLeft: `4px solid ${tColor}`,
              background: `linear-gradient(to right, ${tColor}15, transparent)`
            }}>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                {index === 0 ? "Next Recommended Workout" : "Following Workout"}
              </h2>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ background: tColor, padding: '1rem', borderRadius: '12px', display: 'flex' }}>
                  {iconMap[sug.type]}
                </div>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <h3 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: tColor }}>{sug.type}</h3>
                  <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: sug.workoutSuggestion ? '1.5rem' : '0' }}>
                    {sug.reasoning}
                  </p>
                  
                  {sug.workoutSuggestion && (
                    <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '8px', borderLeft: `2px solid ${tColor}` }}>
                      <h4 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                        💡 {sug.workoutSuggestion.name}
                      </h4>
                      <p style={{ color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: sug.zwiftAlternative ? '1rem' : '0' }}>
                        {sug.workoutSuggestion.details}
                      </p>
                      
                      {sug.zwiftAlternative && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-soft)' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Indoor Option:</span>
                          <a 
                            href={sug.zwiftAlternative.url} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ color: '#fc6719', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                            </svg>
                            {sug.zwiftAlternative.name}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Lookahead */}
      <h2 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
        Upcoming Week Schedule
      </h2>
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '2rem', WebkitOverflowScrolling: 'touch' }}>
        {analysis?.weeklyPlan?.map((plan, i) => {
          const tColor = plan.type === 'Rest' ? 'var(--text-muted)' : suggestionColors[plan.type as keyof typeof suggestionColors];
          return (
            <div key={i} className="glass-panel" style={{ 
              minWidth: '140px', 
              flex: 1, 
              padding: '1.5rem 1rem', 
              textAlign: 'center',
              borderTop: `4px solid ${tColor}`
            }}>
              <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>{plan.day}</h4>
              <div style={{ fontSize: '0.85rem', color: tColor, fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{plan.type}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{plan.description}</div>
            </div>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Endurance Load</h4>
          <span style={{ fontSize: '2rem', color: 'var(--success)', fontWeight: 'bold' }}>
             {Math.round(analysis?.enduranceLoad || 0)}
          </span>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Threshold Load</h4>
          <span style={{ fontSize: '2rem', color: 'var(--warning)', fontWeight: 'bold' }}>
             {Math.round(analysis?.thresholdLoad || 0)}
          </span>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Power Load</h4>
          <span style={{ fontSize: '2rem', color: 'var(--danger)', fontWeight: 'bold' }}>
             {Math.round(analysis?.powerLoad || 0)}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Weekly Timeline Chart Section */}
        <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} color="var(--accent-primary)"/> Weekly Training Timeline
          </h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fill: 'var(--text-main)' }} />
                <Bar dataKey="Endurance" stackId="a" fill="var(--success)" />
                <Bar dataKey="Threshold" stackId="a" fill="var(--warning)" />
                <Bar dataKey="Power" stackId="a" fill="var(--danger)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activities Section */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--accent-primary)"/> Last 5 Activities
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentFive.map((act) => (
              <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', paddingRight: '1rem' }}>{act.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {new Date(act.start_date).toLocaleDateString()} • {Math.round(act.distance / 1000)} km
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ 
                    display: 'inline-block', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px', 
                    fontSize: '0.8rem', 
                    fontWeight: 600,
                    backgroundColor: `${suggestionColors[act.analyzedType as keyof typeof suggestionColors]}20`,
                    color: suggestionColors[act.analyzedType as keyof typeof suggestionColors],
                    marginBottom: '0.2rem'
                  }}>
                    {act.analyzedType}
                  </span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Load: {Math.round(act.analyzedLoad)}</div>
                </div>
              </div>
            ))}
            {recentFive.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No recent activities found.</div>}
          </div>
        </div>
        
      </div>

      {/* Total activities badge */}
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Analyzed <strong style={{ color: 'var(--text-main)' }}>{analysis?.recentTrends?.length || 0}</strong> activities over the last 30 days.
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
