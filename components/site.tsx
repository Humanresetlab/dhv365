import Link from "next/link";
import styles from "./site.module.css";

export function Header() {
  return (
    <header className="nav">
      <div className="wrap navin">
        <Link href="/" className="brand" aria-label="DHV365 home">
          DHV<span>365</span>
        </Link>
        <nav className="links" aria-label="Hoofdnavigatie">
          <Link href="/#diensten">Dienen</Link>
          <Link href="/#werkwijze">Werkwijze</Link>
          <Link href="/veiligheid">Veiligheid</Link>
          <Link href="/werkgebied">Werkgebied</Link>
          <Link href="/inloggen" className={`button ${styles.loginLink}`}>
            Inloggen
          </Link>
          <Link href="/opdracht" className={`button ${styles.primaryAction}`}>
            Opdracht aanvragen <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footerGrid">
          <div>
            <Link href="/" className="brand">
              DHV<span>365</span>
            </Link>
            <p>
              Dedicated High Value & Critical Transport vanuit de regio Velp–Nijmegen.
              Rechtstreeks vervoer zonder overslag, na bevestiging van beschikbaarheid
              en opdrachtacceptatie.
            </p>
          </div>
          <div>
            <h3>Diensten</h3>
            <Link href="/#diensten">Critical Documents</Link>
            <Link href="/#diensten">Time Critical</Link>
            <Link href="/#diensten">Digital & Data</Link>
            <Link href="/#diensten">High Value Handling</Link>
          </div>
          <div>
            <h3>Informatie</h3>
            <Link href="/veiligheid">Veiligheid</Link>
            <Link href="/werkgebied">Europa</Link>
            <Link href="/opdracht">Opdracht aanvragen</Link>
            <Link href="/inloggen">Klantportaal inloggen</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} DHV365. Alle rechten voorbehouden.</span>
          <span>24/7 bereikbaar · inzet na bevestiging</span>
        </div>
      </div>
    </footer>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
