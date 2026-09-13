import { useEffect, useState } from "react";
import { Check, ChevronRight, Radio, Users } from "lucide-react";
import { Brand } from "./shared/Brand";
import { palette } from "./shared/quiz";
import { socket } from "./socket";
import type { JoinResponse, PublicSession } from "./types";

export default function Participant({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(localStorage.getItem("pulse-name") ?? "");
  const [participantId, setParticipantId] = useState(
    localStorage.getItem("pulse-participant-id") ?? "",
  );
  const [state, setState] = useState<PublicSession | null>(null);
  const [answer, setAnswer] = useState<{
    questionId: string;
    optionIds: string[];
  }>({ questionId: "", optionIds: [] });
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [error, setError] = useState("");
  const join = () =>
    socket.emit(
      "participant:join",
      { code, name, participantId: participantId || undefined },
      (response: JoinResponse) => {
        if (!response.ok || !response.state || !response.participantId) {
          setError(response.error ?? "Connexion impossible.");
          return;
        }
        localStorage.setItem("pulse-name", name);
        localStorage.setItem("pulse-participant-id", response.participantId);
        setParticipantId(response.participantId);
        setState(response.state);
        setError("");
      },
    );
  useEffect(() => {
    const receive = (next: PublicSession) => setState(next);
    const reconnect = () => {
      if (state && participantId) join();
    };
    socket.on("session:state", receive);
    socket.on("connect", reconnect);
    return () => {
      socket.off("session:state", receive);
      socket.off("connect", reconnect);
    };
  });
  const selection =
    answer.questionId === state?.question?.id ? answer.optionIds : [];
  const choose = (optionId: string) => {
    if (!state?.question || submittedQuestion === state.question.id) return;
    const optionIds =
      state.question.type === "single"
        ? [optionId]
        : selection.includes(optionId)
          ? selection.filter((id) => id !== optionId)
          : [...selection, optionId];
    setAnswer({ questionId: state.question.id, optionIds });
  };
  const submit = () => {
    if (!state?.question) return;
    socket.emit(
      "participant:answer",
      { participantId, questionId: state.question.id, optionIds: selection },
      (response: JoinResponse) => {
        if (response.ok) setSubmittedQuestion(state.question!.id);
        else setError(response.error ?? "Réponse refusée.");
      },
    );
  };
  if (!state)
    return (
      <main className="participant-shell join-screen">
        <Brand />
        <section>
          <span className="eyebrow">Rejoindre le direct</span>
          <h1>À vous de jouer.</h1>
          <label className="field">
            <span>Code de la session</span>
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
            />
          </label>
          <label className="field">
            <span>Votre prénom</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
            />
          </label>
          <button
            className="primary large"
            onClick={join}
            disabled={code.length !== 6 || !name.trim()}
          >
            Entrer dans la salle <ChevronRight />
          </button>
          {error && <p className="error-message">{error}</p>}
        </section>
      </main>
    );
  if (state.phase === "lobby")
    return (
      <main className="participant-shell waiting">
        <Brand />
        <div className="pulse-mark">
          <Radio />
        </div>
        <span className="eyebrow">Vous êtes connecté</span>
        <h1>Bonjour {name}.</h1>
        <p>Le quiz va bientôt commencer.</p>
        <div className="waiting-count">
          <Users /> {state.participantCount} dans la salle
        </div>
      </main>
    );
  if (state.phase === "finished")
    return (
      <main className="participant-shell waiting">
        <Brand />
        <div className="pulse-mark done">
          <Check />
        </div>
        <span className="eyebrow">C’est terminé</span>
        <h1>Merci {name} !</h1>
        <p>Vous pouvez fermer cette page.</p>
      </main>
    );
  const submitted = submittedQuestion === state.question?.id;
  return (
    <main className="participant-shell question-screen">
      <header>
        <Brand />
        <span>
          {state.currentQuestionIndex + 1} / {state.questionCount}
        </span>
      </header>
      <section>
        <span className="eyebrow">
          {state.question?.type === "multiple"
            ? "Plusieurs réponses possibles"
            : "Une seule réponse"}
        </span>
        <h1>{state.question?.text}</h1>
        <div className="answer-grid">
          {state.question?.options.map((option, index) => {
            const selected = selection.includes(option.id);
            const result = state.results?.find(
              (item) => item.optionId === option.id,
            );
            return (
              <button
                key={option.id}
                className={`answer-option ${selected ? "selected" : ""} ${result?.isCorrect ? "correct" : ""} ${state.phase === "results" && !result?.isCorrect ? "muted" : ""}`}
                onClick={() => choose(option.id)}
              >
                <span style={{ background: palette[index % palette.length] }}>
                  {String.fromCharCode(65 + index)}
                </span>
                <strong>{option.text}</strong>
                {result?.isCorrect && <Check />}
              </button>
            );
          })}
        </div>
        {state.phase === "question" && !submitted && (
          <button
            className="primary large submit-answer"
            disabled={!selection.length}
            onClick={submit}
          >
            Valider ma réponse
          </button>
        )}
        {state.phase === "question" && submitted && (
          <div className="submitted">
            <Check /> Réponse envoyée
          </div>
        )}
        {state.phase === "results" && (
          <div className="submitted">Résultats révélés par l’animateur</div>
        )}
        {error && <p className="error-message">{error}</p>}
      </section>
    </main>
  );
}
