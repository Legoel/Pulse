import { useRef, useState } from "react";
import {
  Check,
  CirclePlus,
  Download,
  FileUp,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { Brand } from "./shared/Brand";
import { formatImportError, starterQuiz } from "./shared/quiz";
import { quizSchema } from "./types";
import type { Question, Quiz } from "./types";

export default function QuizEditor({
  onLaunch,
  busy,
  error,
}: {
  onLaunch: (quiz: Quiz) => void;
  busy: boolean;
  error: string;
}) {
  const [quiz, setQuiz] = useState<Quiz>(() => structuredClone(starterQuiz));
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const exportQuiz = () => {
    const content = JSON.stringify(quiz, null, 2);
    const file = new Blob([content], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `${
      quiz.title
        .trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "quiz"
    }.json`;
    document.body.append(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 0);
  };
  const importQuiz = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsedQuiz = quizSchema.safeParse(JSON.parse(await file.text()));
      if (!parsedQuiz.success) {
        setImportErrors(parsedQuiz.error.issues.map(formatImportError));
        return;
      }
      setQuiz(parsedQuiz.data);
      setImportErrors([]);
    } catch {
      setImportErrors(["Le fichier ne contient pas du JSON valide."]);
    }
  };
  const closeImportErrors = () => setImportErrors([]);

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
        <div className="editor-action-panel">
          <div className="editor-actions">
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept="application/json,.json"
              onChange={importQuiz}
            />
            <button
              className="icon-text-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp /> Importer
            </button>
            <button
              className="icon-text-button"
              type="button"
              onClick={exportQuiz}
            >
              <Download /> Exporter
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => onLaunch(quiz)}
            >
              <Play /> {busy ? "Création…" : "Créer la session"}
            </button>
          </div>
        </div>
      </div>
      {importErrors.length > 0 && (
        <div className="modal-backdrop" onClick={closeImportErrors}>
          <section
            className="import-errors-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-errors-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Import interrompu</span>
                <h2 id="import-errors-title">
                  {importErrors.length} erreur
                  {importErrors.length > 1 ? "s" : ""} à corriger
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                title="Fermer"
                aria-label="Fermer"
                onClick={closeImportErrors}
              >
                <X />
              </button>
            </header>
            <p>Le questionnaire en cours n’a pas été modifié.</p>
            <ul>
              {importErrors.map((importError, index) => (
                <li key={`${importError}-${index}`}>{importError}</li>
              ))}
            </ul>
            <button
              className="primary"
              type="button"
              onClick={closeImportErrors}
            >
              Compris
            </button>
          </section>
        </div>
      )}
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
