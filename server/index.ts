import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type {
  HostResponse,
  HostSession,
  JoinResponse,
  PublicSession,
  Question,
  Quiz,
} from "../src/types.js";
import { quizSchema } from "../src/types.js";

const rootDirectory = process.cwd();
const dataDirectory = path.join(rootDirectory, "data");
const sessionFile = path.join(dataDirectory, "session.json");

interface Participant {
  id: string;
  name: string;
  connected: boolean;
}

interface Session {
  code: string;
  hostToken: string;
  quiz: Quiz;
  phase: PublicSession["phase"];
  currentQuestionIndex: number;
  participants: Record<string, Participant>;
  answers: Record<string, Record<string, string[]>>;
}

function loadSession(): Session | null {
  try {
    const loadedSession = JSON.parse(
      fs.readFileSync(sessionFile, "utf8"),
    ) as Session;
    Object.values(loadedSession.participants).forEach((participant) => {
      participant.connected = false;
    });
    return loadedSession;
  } catch {
    return null;
  }
}

let session = loadSession();

function persist(): void {
  if (!session) return;
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
}

function currentQuestion(): Question | null {
  if (!session || session.currentQuestionIndex < 0) return null;
  return session.quiz.questions[session.currentQuestionIndex] ?? null;
}

function publicState(): PublicSession | null {
  if (!session) return null;
  const question = currentQuestion();
  const questionAnswers = question ? (session.answers[question.id] ?? {}) : {};
  const results =
    session.phase === "results" && question
      ? question.options.map((option) => ({
          optionId: option.id,
          count: Object.values(questionAnswers).filter((answer) =>
            answer.includes(option.id),
          ).length,
          isCorrect: question.correctOptionIds.includes(option.id),
        }))
      : null;

  return {
    code: session.code,
    title: session.quiz.title,
    phase: session.phase,
    participantCount: Object.values(session.participants).filter(
      (participant) => participant.connected,
    ).length,
    answeredCount: Object.keys(questionAnswers).length,
    currentQuestionIndex: session.currentQuestionIndex,
    questionCount: session.quiz.questions.length,
    question: question
      ? {
          id: question.id,
          text: question.text,
          type: question.type,
          options: question.options,
        }
      : null,
    results,
  };
}

function hostState(): HostSession | null {
  const state = publicState();
  if (!state || !session) return null;
  const question = currentQuestion();
  const questionAnswers = question ? (session.answers[question.id] ?? {}) : {};
  const liveResults = question
    ? question.options.map((option) => ({
        optionId: option.id,
        count: Object.values(questionAnswers).filter((answer) =>
          answer.includes(option.id),
        ).length,
        isCorrect: question.correctOptionIds.includes(option.id),
      }))
    : null;
  return {
    ...state,
    results: liveResults,
    quiz: session.quiz,
    hostToken: session.hostToken,
  };
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

function broadcast(): void {
  const state = publicState();
  if (state) io.to(`session:${state.code}`).emit("session:state", state);
  const host = hostState();
  if (host) io.to(`host:${host.hostToken}`).emit("host:state", host);
}

io.on("connection", (socket) => {
  socket.on(
    "host:create",
    (quizInput: unknown, reply: (response: HostResponse) => void) => {
      const parsedQuiz = quizSchema.safeParse(quizInput);
      if (!parsedQuiz.success) {
        reply({
          ok: false,
          error: parsedQuiz.error.issues[0]?.message ?? "Quiz invalide.",
        });
        return;
      }
      session = {
        code: String(crypto.randomInt(100000, 999999)),
        hostToken: crypto.randomUUID(),
        quiz: parsedQuiz.data,
        phase: "lobby",
        currentQuestionIndex: -1,
        participants: {},
        answers: {},
      };
      socket.join(`host:${session.hostToken}`);
      persist();
      reply({ ok: true, state: hostState()! });
    },
  );

  socket.on(
    "host:resume",
    (hostToken: string, reply: (response: HostResponse) => void) => {
      if (!session || session.hostToken !== hostToken) {
        reply({ ok: false, error: "Session animateur introuvable." });
        return;
      }
      socket.join(`host:${hostToken}`);
      reply({ ok: true, state: hostState()! });
    },
  );

  socket.on(
    "host:action",
    (
      payload: {
        hostToken: string;
        action: "start" | "results" | "next" | "finish";
      },
      reply: (response: HostResponse) => void,
    ) => {
      if (!session || session.hostToken !== payload.hostToken) {
        reply({ ok: false, error: "Action non autorisée." });
        return;
      }
      if (payload.action === "start") {
        session.currentQuestionIndex = 0;
        session.phase = "question";
      } else if (payload.action === "results" && currentQuestion()) {
        session.phase = "results";
      } else if (payload.action === "next") {
        if (session.currentQuestionIndex + 1 < session.quiz.questions.length) {
          session.currentQuestionIndex += 1;
          session.phase = "question";
        } else {
          session.phase = "finished";
        }
      } else if (payload.action === "finish") {
        session.phase = "finished";
      }
      persist();
      broadcast();
      reply({ ok: true, state: hostState()! });
    },
  );

  socket.on(
    "participant:join",
    (
      payload: { code: string; name: string; participantId?: string },
      reply: (response: JoinResponse) => void,
    ) => {
      if (!session || session.code !== payload.code.trim()) {
        reply({ ok: false, error: "Code de session inconnu." });
        return;
      }
      const name = payload.name.trim().slice(0, 40);
      if (!name) {
        reply({ ok: false, error: "Saisissez votre prénom." });
        return;
      }
      const participantId =
        payload.participantId && session.participants[payload.participantId]
          ? payload.participantId
          : crypto.randomUUID();
      session.participants[participantId] = {
        id: participantId,
        name,
        connected: true,
      };
      socket.data.participantId = participantId;
      socket.data.sessionCode = session.code;
      socket.join(`session:${session.code}`);
      persist();
      reply({ ok: true, participantId, state: publicState()! });
      broadcast();
    },
  );

  socket.on(
    "participant:answer",
    (
      payload: {
        participantId: string;
        questionId: string;
        optionIds: string[];
      },
      reply: (response: JoinResponse) => void,
    ) => {
      const question = currentQuestion();
      if (
        !session ||
        session.phase !== "question" ||
        !question ||
        question.id !== payload.questionId ||
        !session.participants[payload.participantId]
      ) {
        reply({
          ok: false,
          error: "Cette question n’accepte plus de réponse.",
        });
        return;
      }
      const validIds = new Set(question.options.map((option) => option.id));
      const optionIds = [...new Set(payload.optionIds)].filter((id) =>
        validIds.has(id),
      );
      if (
        optionIds.length < 1 ||
        (question.type === "single" && optionIds.length !== 1)
      ) {
        reply({ ok: false, error: "Sélection invalide." });
        return;
      }
      session.answers[question.id] ??= {};
      session.answers[question.id][payload.participantId] = optionIds;
      persist();
      broadcast();
      reply({ ok: true, state: publicState()! });
    },
  );

  socket.on("disconnect", () => {
    if (!session || !socket.data.participantId) return;
    const participant = session.participants[socket.data.participantId];
    if (participant) participant.connected = false;
    persist();
    broadcast();
  });
});

app.get("/api/health", (_request, response) => response.json({ ok: true }));

const distDirectory = path.join(rootDirectory, "dist");
if (fs.existsSync(distDirectory)) {
  app.use(express.static(distDirectory));
  app.use((_request, response) =>
    response.sendFile(path.join(distDirectory, "index.html")),
  );
}

const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Pulse écoute sur http://localhost:${port}`);
});
