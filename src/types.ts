import { z } from "zod";

export type QuestionType = "single" | "multiple";
export type SessionPhase = "lobby" | "question" | "results" | "finished";

export const optionSchema = z.object({
  id: z.string().min(1),
  text: z
    .string()
    .trim()
    .min(1, "Chaque réponse doit contenir du texte.")
    .max(160, "Une réponse ne peut pas dépasser 160 caractères."),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  text: z
    .string()
    .trim()
    .min(1, "Chaque question doit contenir du texte.")
    .max(300, "Une question ne peut pas dépasser 300 caractères."),
  type: z.enum(["single", "multiple"]),
  options: z
    .array(optionSchema)
    .min(2, "Chaque question doit proposer au moins 2 réponses.")
    .max(8, "Une question ne peut pas proposer plus de 8 réponses."),
  correctOptionIds: z
    .array(z.string())
    .min(1, "Chaque question doit avoir au moins une bonne réponse."),
});

export const quizSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Le questionnaire doit avoir un titre.")
      .max(120, "Le titre ne peut pas dépasser 120 caractères."),
    questions: z
      .array(questionSchema)
      .min(1, "Le questionnaire doit contenir au moins une question.")
      .max(50, "Le questionnaire ne peut pas contenir plus de 50 questions."),
  })
  .superRefine((quiz, context) => {
    const questionIds = new Map<string, number>();
    const optionIds = new Map<
      string,
      { questionIndex: number; optionIndex: number }
    >();
    quiz.questions.forEach((question, questionIndex) => {
      const existingQuestionIndex = questionIds.get(question.id);
      if (existingQuestionIndex !== undefined) {
        context.addIssue({
          code: "custom",
          message: `Son identifiant est déjà utilisé par la question ${existingQuestionIndex + 1}.`,
          path: ["questions", questionIndex, "id"],
        });
      } else {
        questionIds.set(question.id, questionIndex);
      }

      const optionIdsForQuestion = new Set<string>();
      question.options.forEach((option, optionIndex) => {
        const existingOption = optionIds.get(option.id);
        if (existingOption) {
          context.addIssue({
            code: "custom",
            message: `Son identifiant est déjà utilisé par la réponse ${existingOption.optionIndex + 1} de la question ${existingOption.questionIndex + 1}.`,
            path: ["questions", questionIndex, "options", optionIndex, "id"],
          });
        } else {
          optionIds.set(option.id, { questionIndex, optionIndex });
        }
        optionIdsForQuestion.add(option.id);
      });

      if (
        question.correctOptionIds.some((id) => !optionIdsForQuestion.has(id))
      ) {
        context.addIssue({
          code: "custom",
          message: `La question ${questionIndex + 1} référence une bonne réponse introuvable.`,
          path: ["questions", questionIndex, "correctOptionIds"],
        });
      }
      if (
        question.type === "single" &&
        question.correctOptionIds.length !== 1
      ) {
        context.addIssue({
          code: "custom",
          message: `La question ${questionIndex + 1} doit avoir exactement une bonne réponse.`,
          path: ["questions", questionIndex, "correctOptionIds"],
        });
      }
    });
  });

export type Option = z.infer<typeof optionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Quiz = z.infer<typeof quizSchema>;

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
