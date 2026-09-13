import { useState } from "react";
import { ChevronRight, Presentation, QrCode } from "lucide-react";
import { Brand } from "./shared/Brand";
import { go } from "./shared/navigation";

export default function Home() {
  const [code, setCode] = useState("");
  return (
    <main className="home-shell">
      <header>
        <Brand />
        <span className="status-dot">Temps réel</span>
      </header>
      <section className="home-main">
        <div className="home-copy">
          <span className="eyebrow">Quiz interactif en direct</span>
          <h1>
            Faites participer
            <br />
            toute la salle.
          </h1>
          <p>
            Posez vos questions, recueillez les réponses et révélez les
            résultats au rythme de votre présentation.
          </p>
          <button className="primary large" onClick={() => go("/host")}>
            <Presentation /> Préparer un quiz
          </button>
        </div>
        <div className="join-panel">
          <QrCode size={30} />
          <h2>Rejoindre une session</h2>
          <p>Entrez le code affiché par l’animateur.</p>
          <input
            className="code-input"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000 000"
            inputMode="numeric"
            aria-label="Code de session"
          />
          <button
            className="secondary"
            disabled={code.length !== 6}
            onClick={() => go(`/join/${code}`)}
          >
            Rejoindre <ChevronRight />
          </button>
        </div>
      </section>
      <footer>
        Conçu pour les échanges qui méritent mieux qu’un silence poli.
      </footer>
    </main>
  );
}
