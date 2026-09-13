import { lazy, Suspense, useEffect, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  Copy,
  Play,
  RotateCcw,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Brand } from "./shared/Brand";
import { socket } from "./socket";
import type { HostResponse, HostSession, Quiz } from "./types";
import QuizEditor from "./QuizEditor";

const ResultsChart = lazy(() => import("./ResultsChart"));

function HostLive({
  state,
  setState,
  onNewQuiz,
}: {
  state: HostSession;
  setState: (state: HostSession) => void;
  onNewQuiz: () => void;
}) {
  const joinUrl = `${window.location.origin}/join/${state.code}`;
  const [showChart, setShowChart] = useState(false);
  const chartVisible = showChart || state.phase === "results";
  const correctOptions = state.question?.options.filter((option) =>
    state.results?.some(
      (result) => result.optionId === option.id && result.isCorrect,
    ),
  );
  useEffect(() => {
    const receive = (next: HostSession) => setState(next);
    socket.on("host:state", receive);
    return () => {
      socket.off("host:state", receive);
    };
  }, [setState]);
  const action = (name: "start" | "results" | "next" | "finish") =>
    socket.emit(
      "host:action",
      { hostToken: state.hostToken, action: name },
      (response: HostResponse) => response.state && setState(response.state),
    );
  const resetQuiz = () => {
    if (
      !window.confirm(
        "Interrompre le quiz ? Les participants verront que la session est terminée.",
      )
    )
      return;
    socket.emit(
      "host:action",
      { hostToken: state.hostToken, action: "finish" },
      (response: HostResponse) => {
        if (response.ok) onNewQuiz();
      },
    );
  };
  if (state.phase === "lobby")
    return (
      <main className="live-shell lobby">
        <header>
          <Brand />
          <div className="connection-count">
            <Users /> <strong>{state.participantCount}</strong> participant
            {state.participantCount > 1 ? "s" : ""}
          </div>
        </header>
        <section className="lobby-content">
          <div>
            <span className="eyebrow">La salle est ouverte</span>
            <h1>{state.title}</h1>
            <p>Scannez le QR code ou saisissez l’url dans votre navigateur.</p>
            <div className="session-code">
              {state.code.slice(0, 3)} {state.code.slice(3)}
            </div>
          </div>
          <div className="qr-block">
            <QRCodeSVG
              value={joinUrl}
              size={230}
              bgColor="transparent"
              fgColor="#252722"
            />
            <button
              className="join-url-button"
              title="Copier le lien de participation"
              onClick={() => navigator.clipboard.writeText(joinUrl)}
            >
              <Copy /> <span>{joinUrl}</span>
            </button>
          </div>
        </section>
        <button
          className="primary large start-button"
          onClick={() => action("start")}
          disabled={state.participantCount === 0}
        >
          <Play /> Lancer le quiz
        </button>
      </main>
    );
  if (state.phase === "finished")
    return (
      <main className="finished-screen">
        <Brand />
        <div>
          <span className="eyebrow">Session terminée</span>
          <h1>Merci pour votre participation.</h1>
          <p>{state.participantCount} personnes ont pris part au quiz.</p>
        </div>
        <button className="secondary" onClick={onNewQuiz}>
          Nouveau quiz
        </button>
      </main>
    );
  return (
    <main className="live-shell">
      <header>
        <Brand />
        <div className="live-meta">
          <span>
            Question {state.currentQuestionIndex + 1}/{state.questionCount}
          </span>
          <span>
            <Users /> {state.participantCount}
          </span>
          <span>
            <BarChart3 /> {state.answeredCount} réponses
          </span>
        </div>
      </header>
      <section className="live-question">
        <div className="question-display">
          <span className="eyebrow">
            {state.question?.type === "multiple"
              ? "Plusieurs réponses possibles"
              : "Une seule réponse"}
          </span>
          <h1>{state.question?.text}</h1>
          {state.phase === "results" && correctOptions && (
            <div className="correct-answers" aria-label="Bonnes réponses">
              <Check />
              <span>
                {correctOptions.length > 1
                  ? "Bonnes réponses"
                  : "Bonne réponse"}{" "}
                : {correctOptions.map((option) => option.text).join(" · ")}
              </span>
            </div>
          )}
        </div>
        {chartVisible ? (
          <Suspense fallback={<div className="chart-wrap" />}>
            <ResultsChart state={state} />
          </Suspense>
        ) : (
          <div className="response-counter" aria-live="polite">
            <Users />
            <strong>{state.answeredCount}</strong>
            <span>réponse{state.answeredCount > 1 ? "s" : ""}</span>
            <small>
              sur {state.participantCount} participant
              {state.participantCount > 1 ? "s" : ""}
            </small>
          </div>
        )}
      </section>
      <footer className="host-controls">
        <div>
          <strong>
            {state.answeredCount}/{state.participantCount}
          </strong>{" "}
          ont répondu
        </div>
        <div className="progress">
          <i
            style={{
              width: `${state.participantCount ? (state.answeredCount / state.participantCount) * 100 : 0}%`,
            }}
          />
        </div>
        {state.phase === "question" && (
          <label className="chart-toggle">
            <input
              type="checkbox"
              checked={showChart}
              onChange={(event) => setShowChart(event.target.checked)}
            />
            <span aria-hidden="true" />
            Afficher le graphique
          </label>
        )}
        <button
          className="reset-session-button"
          type="button"
          title="Interrompre le quiz et revenir à la préparation"
          onClick={resetQuiz}
        >
          <RotateCcw /> Repartir à zéro
        </button>
        {state.phase === "question" ? (
          <button className="primary" onClick={() => action("results")}>
            Révéler les réponses
          </button>
        ) : (
          <button className="primary" onClick={() => action("next")}>
            {state.currentQuestionIndex + 1 === state.questionCount
              ? "Terminer"
              : "Question suivante"}{" "}
            <ChevronRight />
          </button>
        )}
      </footer>
    </main>
  );
}

export default function Host() {
  const [state, setState] = useState<HostSession | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const resume = () => {
      const hostToken = localStorage.getItem("pulse-host-token");
      if (hostToken)
        socket.emit(
          "host:resume",
          hostToken,
          (response: HostResponse) =>
            response.state && setState(response.state),
        );
    };
    resume();
    socket.on("connect", resume);
    return () => {
      socket.off("connect", resume);
    };
  }, []);
  const launch = (quiz: Quiz) => {
    setBusy(true);
    setError("");
    socket.emit("host:create", quiz, (response: HostResponse) => {
      setBusy(false);
      if (!response.ok || !response.state) {
        setError(response.error ?? "Impossible de créer la session.");
        return;
      }
      localStorage.setItem("pulse-host-token", response.state.hostToken);
      setState(response.state);
    });
  };
  const newQuiz = () => {
    localStorage.removeItem("pulse-host-token");
    setState(null);
  };
  return state ? (
    <HostLive state={state} setState={setState} onNewQuiz={newQuiz} />
  ) : (
    <QuizEditor onLaunch={launch} busy={busy} error={error} />
  );
}
