export type QuestionType = "single" | "multiple";
export type SessionPhase = "lobby" | "question" | "results" | "finished";

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: Option[];
  correctOptionIds: string[];
}

export interface Quiz {
  title: string;
  questions: Question[];
}

export interface ResultItem {
  optionId: string;
  count: number;
  isCorrect: boolean;
}

export interface PublicSession {
  code: string;
  title: string;
  phase: SessionPhase;
  participantCount: number;
  answeredCount: number;
  currentQuestionIndex: number;
  questionCount: number;
  question: Omit<Question, "correctOptionIds"> | null;
  results: ResultItem[] | null;
}

export interface HostSession extends PublicSession {
  quiz: Quiz;
  hostToken: string;
}

export interface JoinResponse {
  ok: boolean;
  error?: string;
  participantId?: string;
  state?: PublicSession;
}

export interface HostResponse {
  ok: boolean;
  error?: string;
  state?: HostSession;
}
