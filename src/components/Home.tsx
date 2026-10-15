import { useState } from 'react';
import { STRAVA_AUTH_URL } from '../api/strava';
import { 
  Zap, 
  Activity, 
  ShieldCheck, 
  HeartPulse, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Eye, 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';

interface HomeProps {
  onOpenDemo: () => void;
}

export default function Home({ onOpenDemo }: HomeProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'Waarom vraagt Watts Next om met Strava te koppelen?',
      a: 'Watts Next heeft je recente ritten, vermogensdata (wattage) en hartslag nodig om te kunnen berekenen hoe je trainingsbelasting is verdeeld. Zonder deze ritten kan het algoritme je geen onderbouwd advies geven over je volgende trainingsdoel.'
    },
    {
      q: 'Kan Watts Next ritten wijzigen of namens mij iets op Strava plaatsen?',
      a: 'Absoluut niet. Wij vragen uitsluitend om de permissies "read" en "activity:read_all". Dit is 100% leestoegang. Wij kunnen op geen enkele manier iets bewerken, verwijderen of plaatsen op je Strava-profiel.'
    },
    {
      q: 'Waar wordt mijn sportdata opgeslagen?',
      a: 'In tegenstelling tot veel andere platforms slaan wij jouw data NOOIT op in een externe database. Zodra je synchroniseert, worden de activiteiten direct en uitsluitend in de lokale database (IndexedDB) van je eigen browser bewaard. Verwijder je je browsergeschiedenis of log je uit, dan is de data weg.'
    },
    {
      q: 'Wat als ik geen vermogensmeter (wattagemeter) heb?',
      a: 'Geen probleem! Als je met een hartslagmeter rijdt of Strava een geschatte trainingsinspanning (suffer score) toekent, gebruikt Watts Next automatisch hartslag- en snelheidsheuristieken om je inspanningsniveau in te schatten.'
    },
    {
      q: 'Wat kost Watts Next?',
      a: 'Watts Next is 100% gratis te gebruiken voor alle wielrenners, gravelrijders en Zwifters.'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(15, 17, 21, 0.8)',
        borderBottom: '1px solid var(--border-soft)',
        padding: '1rem 2rem'
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(252, 76, 2, 0.4)'
            }}>
              <Zap size={20} color="white" />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Watts <span className="text-gradient">Next</span>
            </span>
          </div>

          {/* Nav Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={onOpenDemo}
              className="btn-glass"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.9rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer'
              }}
            >
              <Eye size={16} /> Demo Bekijken
            </button>
            <a 
              href={STRAVA_AUTH_URL} 
              className="btn"
              style={{
                fontSize: '0.9rem',
                padding: '0.5rem 1.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Activity size={16} /> Koppel Strava
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        padding: '5rem 1.5rem 4rem',
        maxWidth: '1000px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        {/* Highlight pill */}
        <div className="animate-fade-in" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(252, 76, 2, 0.1)',
          border: '1px solid rgba(252, 76, 2, 0.25)',
          borderRadius: '50px',
          padding: '0.35rem 1rem',
          fontSize: '0.85rem',
          color: 'var(--accent-secondary)',
          fontWeight: 500,
          marginBottom: '1.75rem'
        }}>
          <Sparkles size={15} /> Slimme trainingssturing voor wielrenners & Zwifters
        </div>

        <h1 className="animate-fade-in text-gradient" style={{
          fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
          lineHeight: 1.15,
          fontWeight: 700,
          marginBottom: '1.5rem',
          letterSpacing: '-0.03em'
        }}>
          Weet exact wat je volgende training moet zijn.
        </h1>

        <p className="animate-fade-in" style={{
          fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
          color: 'var(--text-muted)',
          maxWidth: '720px',
          margin: '0 auto 2.5rem',
          lineHeight: 1.6
        }}>
          Watts Next analyseert je recente Strava-ritten, vermogensopbouw en trainingsbelasting. 
          Geen nattevingerwerk meer: ontdek direct of je lichaam vandaag klaar is voor 
          drempelintervallen, VO2max-prikkels of een rustige zone 2 duurrit.
        </p>

        {/* Action Buttons */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '3rem'
        }}>
          <a 
            href={STRAVA_AUTH_URL} 
            className="btn"
            style={{
              padding: '0.9rem 2rem',
              fontSize: '1.05rem',
              fontWeight: 600,
              boxShadow: '0 8px 25px rgba(252, 76, 2, 0.35)'
            }}
          >
            <Activity size={20} /> Koppel direct met Strava <ArrowRight size={18} />
          </a>

          <button 
            onClick={onOpenDemo}
            className="btn-glass"
            style={{
              padding: '0.9rem 1.75rem',
              fontSize: '1.05rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Eye size={18} /> Bekijk eerst de demo
          </button>
        </div>

        {/* Trust Badges */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          flexWrap: 'wrap',
          color: 'var(--text-muted)',
          fontSize: '0.9rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Lock size={16} color="var(--success)" /> 100% Lokaal & Privé (IndexedDB)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} color="var(--success)" /> Alleen leestoegang (read-only)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={16} color="var(--success)" /> Geen account of wachtwoord nodig
          </div>
        </div>
      </section>

      {/* Feature Preview Cards: The 3 Workout Targets */}
      <section style={{
        maxWidth: '1100px',
        margin: '0 auto 5rem',
        padding: '0 1.5rem',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Drie pijlers, altijd in balans</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Het algoritme analyseert je afgelopen trainingsweken en berekent welke prikkel nu nodig is:
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Card 1: Endurance */}
          <div className="glass-panel" style={{
            padding: '1.75rem',
            borderTop: '3px solid var(--success)',
            position: 'relative'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              color: 'var(--success)'
            }}>
              <HeartPulse size={24} />
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Zone 2 Duurtraining</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              De fundering van elke fietser. Versterkt je mitochondriën, optimaliseert vetverbranding en bouwt een onuitputtelijke aerobe basis zonder je centrale zenuwstelsel te overbelasten.
            </p>
            <div style={{
              fontSize: '0.85rem',
              background: 'rgba(255,255,255,0.03)',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              color: 'var(--text-main)'
            }}>
              💡 <strong>Advies bij:</strong> Hoge vermoeidheid of ontbrekende aerobe basis.
            </div>
          </div>

          {/* Card 2: Threshold */}
          <div className="glass-panel" style={{
            padding: '1.75rem',
            borderTop: '3px solid var(--warning)',
            position: 'relative'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              color: 'var(--warning)'
            }}>
              <Activity size={24} />
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Threshold & Sweetspot</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              De snelste weg naar een hogere FTP. Leert je spieren omgaan met lactaatproductie rondom je omslagpunt. Onmisbaar voor tijdrijders, klimmers en snelle groepsritten.
            </p>
            <div style={{
              fontSize: '0.85rem',
              background: 'rgba(255,255,255,0.03)',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              color: 'var(--text-main)'
            }}>
              💡 <strong>Advies bij:</strong> Goede basisrust en behoefte aan duurvermogen op tempo.
            </div>
          </div>

          {/* Card 3: Power */}
          <div className="glass-panel" style={{
            padding: '1.75rem',
            borderTop: '3px solid var(--danger)',
            position: 'relative'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              color: 'var(--danger)'
            }}>
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>VO2max & Power Sprints</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              Korte, intensieve intervallen boven je FTP om je cardiovasculaire maximum op te krikken. Ideaal om venijnige heuveltjes op te knallen en gaten dicht te rijden.
            </p>
            <div style={{
              fontSize: '0.85rem',
              background: 'rgba(255,255,255,0.03)',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              color: 'var(--text-main)'
            }}>
              💡 <strong>Advies bij:</strong> Voldoende herstel en behoefte aan piekintensiteit.
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section style={{
        backgroundColor: 'rgba(24, 27, 33, 0.5)',
        borderTop: '1px solid var(--border-soft)',
        borderBottom: '1px solid var(--border-soft)',
        padding: '5rem 1.5rem'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{
              color: 'var(--accent-primary)',
              textTransform: 'uppercase',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.05em'
            }}>
              Transparant & Veilig
            </span>
            <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>Hoe werkt de koppeling?</h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '2rem'
          }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1rem'
              }}>1</div>
              <h3 style={{ fontSize: '1.2rem' }}>Toestemming via Strava</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Je logt in via het officiële Strava OAuth-scherm. Je deelt nooit je wachtwoord met Watts Next. Wij vragen alleen leestoegang tot je ritten.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1rem'
              }}>2</div>
              <h3 style={{ fontSize: '1.2rem' }}>Lokale Berekening</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Jouw ritten worden rechtstreeks naar de lokale database (IndexedDB) van je eigen browser gestuurd. Wij hebben geen centrale cloud database waarin jouw routes of hartslagen worden opgeslagen.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1rem'
              }}>3</div>
              <h3 style={{ fontSize: '1.2rem' }}>Direct Doelgericht Trainen</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Watts Next toont je wekelijkse trainingsload en adviseert je concrete workout (inclusief wattage- en cadanssuggesties en Zwift alternatieven).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Spotlight Callout */}
      <section style={{
        maxWidth: '1000px',
        margin: '5rem auto',
        padding: '0 1.5rem',
        width: '100%'
      }}>
        <div className="glass-panel" style={{
          background: 'linear-gradient(135deg, rgba(24, 27, 33, 0.9), rgba(30, 35, 45, 0.8))',
          border: '1px solid rgba(252, 76, 2, 0.25)',
          padding: '2.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-secondary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <Lock size={16} /> Privacy-First Design
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
              Waarom wij géén centrale database hebben
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: '1rem' }}>
              Veel fitness-apps slaan al je GPS-locaties, routes en hartslaggegevens op in grote cloud databases. 
              Bij <strong>Watts Next</strong> geloven we dat sportdata van jou is. 
            </p>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem' }}>
              Door alles lokaal in je eigen browser op te slaan (IndexedDB), is er <strong>nul risico</strong> op datalekken via onze servers en ben je razendsnel klaar om te trainen.
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: 'rgba(15, 17, 21, 0.6)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid var(--border-soft)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={20} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>Geen nieuw account nodig</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Koppel eenmalig met Strava en je bent direct klaar.</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={20} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>Geen tracking van persoonsgegevens</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Jouw vermogensprofiel blijft strikt op jouw computer.</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={20} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>Direct wissen met 1 klik</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Klik op 'Uitloggen' en alle lokale data wordt direct gewist.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section style={{
        maxWidth: '800px',
        margin: '0 auto 5rem',
        padding: '0 1.5rem',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Veelgestelde vragen</h2>
          <p style={{ color: 'var(--text-muted)' }}>Alles wat je moet weten over Watts Next en Strava</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div 
                key={index} 
                className="glass-panel" 
                style={{ 
                  padding: '1.25rem', 
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onClick={() => toggleFaq(index)}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  color: isOpen ? 'var(--accent-secondary)' : 'var(--text-main)'
                }}>
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {isOpen && (
                  <p style={{
                    marginTop: '0.75rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.95rem',
                    lineHeight: 1.6
                  }}>
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section style={{
        backgroundColor: 'rgba(24, 27, 33, 0.4)',
        borderTop: '1px solid var(--border-soft)',
        padding: '4rem 1.5rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Klaar om gerichter te trainen?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Koppel je Strava of start met de demo en ontdek direct jouw optimale volgende workout.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <a href={STRAVA_AUTH_URL} className="btn" style={{ padding: '0.85rem 2rem' }}>
              <Activity size={18} /> Koppel met Strava
            </a>
            <button onClick={onOpenDemo} className="btn-glass" style={{ padding: '0.85rem 1.75rem', cursor: 'pointer' }}>
              <Eye size={18} /> Bekijk Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem 1.5rem',
        textAlign: 'center',
        borderTop: '1px solid var(--border-soft)',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        <p style={{ marginBottom: '0.5rem' }}>
          © {new Date().getFullYear()} <strong>Watts Next</strong> (watts-next.nl). Gemaakt voor wielrenners, gravellaars en Zwift-fanaten.
        </p>
        <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
          Watts Next is niet geaffilieerd met of goedgekeurd door Strava, Inc. Alle handelsmerken zijn eigendom van hun respectievelijke eigenaren.
        </p>
      </footer>
    </div>
  );
}
