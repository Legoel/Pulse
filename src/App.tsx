import { useEffect, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronRight,
  CirclePlus,
  Copy,
  Play,
  Presentation,
  QrCode,
  Radio,
  Trash2,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import { socket } from "./socket";
import type {
  HostResponse,
  HostSession,
  JoinResponse,
  PublicSession,
  Question,
  Quiz,
} from "./types";

const palette = [
  "#ed5b3a",
  "#087f73",
  "#e8a52b",
  "#4b62a8",
  "#be4774",
  "#5d8244",
  "#805ca4",
  "#53727f",
];

const starterQuiz: Quiz = {
  title: "L’IA a-t-elle éclipsé l’éco-conception ?",
  questions: [
    {
      id: crypto.randomUUID(),
      text: "Quel poste représente aujourd’hui la plus grande part de l’empreinte carbone du numérique en France ?",
      type: "single",
      options: [
        { id: crypto.randomUUID(), text: "Les centres de données" },
        { id: crypto.randomUUID(), text: "Les réseaux" },
        { id: crypto.randomUUID(), text: "Les terminaux utilisateurs" },
      ],
      correctOptionIds: [],
    },
    {
      id: crypto.randomUUID(),
      text: "Quels leviers contribuent à une application plus sobre ?",
      type: "multiple",
      options: [
        { id: crypto.randomUUID(), text: "Questionner le besoin" },
        { id: crypto.randomUUID(), text: "Limiter les données transférées" },
        {
          id: crypto.randomUUID(),
          text: "Multiplier les fonctionnalités par défaut",
        },
        { id: crypto.randomUUID(), text: "Mesurer les usages réels" },
      ],
      correctOptionIds: [],
    },
  ],
};
starterQuiz.questions[0].correctOptionIds = [
  starterQuiz.questions[0].options[2].id,
];
starterQuiz.questions[1].correctOptionIds = [
  starterQuiz.questions[1].options[0].id,
  starterQuiz.questions[1].options[1].id,
  starterQuiz.questions[1].options[3].id,
];

function go(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return path;
}

function Brand() {
  return (
    <button className="brand" onClick={() => go("/")}>
      <Radio size={25} /> Pulse
    </button>
  );
}

function Home() {
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

function QuizEditor({
  onLaunch,
  busy,
  error,
}: {
  onLaunch: (quiz: Quiz) => void;
  busy: boolean;
  error: string;
}) {
  const [quiz, setQuiz] = useState<Quiz>(() => structuredClone(starterQuiz));
  const updateQuestion = (
    index: number,
    update: (question: Question) => Question,
  ) =>
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? update(question) : question,
      ),
    }));
  const addQuestion = () =>
    setQuiz((current) => ({
      ...current,
      questions: [
        ...current.questions,
        {
          id: crypto.randomUUID(),
          text: "",
          type: "single",
          options: [
            { id: crypto.randomUUID(), text: "" },
            { id: crypto.randomUUID(), text: "" },
          ],
          correctOptionIds: [],
        },
      ],
    }));

  return (
    <main className="editor-shell">
      <header>
        <Brand />
        <span>Préparation</span>
      </header>
      <div className="editor-heading">
        <div>
          <span className="eyebrow">Votre présentation</span>
          <h1>Préparez les questions</h1>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => onLaunch(quiz)}
        >
          <Play /> {busy ? "Création…" : "Créer la session"}
        </button>
      </div>
      <label className="field title-field">
        <span>Titre du quiz</span>
        <input
          value={quiz.title}
          onChange={(event) => setQuiz({ ...quiz, title: event.target.value })}
        />
      </label>
      <div className="question-list">
        {quiz.questions.map((question, questionIndex) => (
          <article className="question-editor" key={question.id}>
            <div className="question-number">
              {String(questionIndex + 1).padStart(2, "0")}
            </div>
            <div className="question-body">
              <div className="question-toolbar">
                <select
                  value={question.type}
                  onChange={(event) =>
                    updateQuestion(questionIndex, (current) => ({
                      ...current,
                      type: event.target.value as Question["type"],
                      correctOptionIds: current.correctOptionIds.slice(
                        0,
                        event.target.value === "single" ? 1 : undefined,
                      ),
                    }))
                  }
                >
                  <option value="single">Une bonne réponse</option>
                  <option value="multiple">Plusieurs bonnes réponses</option>
                </select>
                {quiz.questions.length > 1 && (
                  <button
                    className="icon-button danger"
                    title="Supprimer la question"
                    onClick={() =>
                      setQuiz({
                        ...quiz,
                        questions: quiz.questions.filter(
                          (item) => item.id !== question.id,
                        ),
                      })
                    }
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
              <input
                className="question-input"
                value={question.text}
                placeholder="Votre question…"
                onChange={(event) =>
                  updateQuestion(questionIndex, (current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
              />
              <div className="options-editor">
                {question.options.map((option, optionIndex) => {
                  const correct = question.correctOptionIds.includes(option.id);
                  return (
                    <div className="option-edit" key={option.id}>
                      <button
                        className={`correct-toggle ${correct ? "active" : ""}`}
                        title="Marquer comme bonne réponse"
                        onClick={() =>
                          updateQuestion(questionIndex, (current) => ({
                            ...current,
                            correctOptionIds: correct
                              ? current.correctOptionIds.filter(
                                  (id) => id !== option.id,
                                )
                              : current.type === "single"
                                ? [option.id]
                                : [...current.correctOptionIds, option.id],
                          }))
                        }
                      >
                        <Check />
                      </button>
                      <span>{String.fromCharCode(65 + optionIndex)}</span>
                      <input
                        value={option.text}
                        placeholder={`Réponse ${optionIndex + 1}`}
                        onChange={(event) =>
                          updateQuestion(questionIndex, (current) => ({
                            ...current,
                            options: current.options.map((item) =>
                              item.id === option.id
                                ? { ...item, text: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                      {question.options.length > 2 && (
                        <button
                          className="icon-button"
                          title="Supprimer cette réponse"
                          onClick={() =>
                            updateQuestion(questionIndex, (current) => ({
                              ...current,
                              options: current.options.filter(
                                (item) => item.id !== option.id,
                              ),
                              correctOptionIds: current.correctOptionIds.filter(
                                (id) => id !== option.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {question.options.length < 8 && (
                <button
                  className="text-button"
                  onClick={() =>
                    updateQuestion(questionIndex, (current) => ({
                      ...current,
                      options: [
                        ...current.options,
                        { id: crypto.randomUUID(), text: "" },
                      ],
                    }))
                  }
                >
                  <CirclePlus /> Ajouter une réponse
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <button className="add-question" onClick={addQuestion}>
        <CirclePlus /> Ajouter une question
      </button>
      {error && <p className="error-message">{error}</p>}
    </main>
  );
}

function ResultsChart({ state }: { state: HostSession }) {
  const data =
    state.question?.options.map((option, index) => ({
      name: `${String.fromCharCode(65 + index)}. ${option.text}`,
      votes:
        state.results?.find((result) => result.optionId === option.id)?.count ??
        0,
      color: palette[index % palette.length],
    })) ?? [];
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 35 }}>
          <CartesianGrid horizontal={false} stroke="#dedbd2" />
          <XAxis
            type="number"
            allowDecimals={false}
            domain={[0, Math.max(1, state.participantCount)]}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fill: "#252722", fontSize: 13 }}
          />
          <Bar
            dataKey="votes"
            radius={[0, 5, 5, 0]}
            label={{ position: "right", fill: "#252722", fontWeight: 800 }}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HostLive({
  state,
  setState,
}: {
  state: HostSession;
  setState: (state: HostSession) => void;
}) {
  const joinUrl = `${window.location.origin}/join/${state.code}`;
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
            <p>
              Scannez le QR code ou rendez-vous sur{" "}
              <strong>{window.location.host}</strong>
            </p>
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
              className="text-button"
              onClick={() => navigator.clipboard.writeText(joinUrl)}
            >
              <Copy /> Copier le lien
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
        <button
          className="secondary"
          onClick={() => {
            localStorage.removeItem("pulse-host-token");
            go("/host");
          }}
        >
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
        </div>
        <ResultsChart state={state} />
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

function Host() {
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
  return state ? (
    <HostLive state={state} setState={setState} />
  ) : (
    <QuizEditor onLaunch={launch} busy={busy} error={error} />
  );
}

function Participant({ initialCode }: { initialCode: string }) {
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

export default function App() {
  const path = usePath();
  if (path === "/host") return <Host />;
  const joinMatch = path.match(/^\/join\/(\d{6})$/);
  if (joinMatch) return <Participant initialCode={joinMatch[1]} />;
  return <Home />;
}
