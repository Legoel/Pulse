import type { Quiz } from "../types";

export const palette = [
  "#ed5b3a",
  "#087f73",
  "#e8a52b",
  "#4b62a8",
  "#be4774",
  "#5d8244",
  "#805ca4",
  "#53727f",
];

export function formatImportError(issue: {
  message: string;
  path: PropertyKey[];
}): string {
  const questionIndex =
    issue.path[0] === "questions" && typeof issue.path[1] === "number"
      ? issue.path[1] + 1
      : null;
  const optionIndex =
    issue.path[2] === "options" && typeof issue.path[3] === "number"
      ? issue.path[3] + 1
      : null;
  if (!questionIndex) return issue.message;
  const location = optionIndex
    ? `Question ${questionIndex}, réponse ${optionIndex}`
    : `Question ${questionIndex}`;
  return `${location} : ${issue.message}`;
}

export const starterQuiz: Quiz = {
  title: "Le grand test de connaissances parfaitement inutiles",
  questions: [
    {
      id: crypto.randomUUID(),
      text: "Pourquoi Superman porte-t-il son slip sur son pantalon ?",
      type: "multiple",
      options: [
        { id: crypto.randomUUID(), text: "Pour le salir moins vite." },
        {
          id: crypto.randomUUID(),
          text: "Parce que personne n’ose lui faire la remarque.",
        },
        {
          id: crypto.randomUUID(),
          text: "Parce que c’est super dur de se changer dans une cabine téléphonique.",
        },
        {
          id: crypto.randomUUID(),
          text: "Il n’y a aucune explication officielle à cette question.",
        },
      ],
      correctOptionIds: [],
    },
    {
      id: crypto.randomUUID(),
      text: "Pourquoi les flamants roses sont-ils roses ?",
      type: "single",
      options: [
        {
          id: crypto.randomUUID(),
          text: "Parce qu’ils sont roses, c’est comme ça.",
        },
        {
          id: crypto.randomUUID(),
          text: "Parce qu’ils mangent trop de crevettes.",
        },
        {
          id: crypto.randomUUID(),
          text: "Parce que le plumage, blanc d’origine, absorbe les rayons du soleil mais ne restitue que la couleur rose.",
        },
        { id: crypto.randomUUID(), text: "Parce qu’ils sont hyper girly." },
      ],
      correctOptionIds: [],
    },
  ],
};
starterQuiz.questions[0].correctOptionIds = [
  starterQuiz.questions[0].options[2].id,
  starterQuiz.questions[0].options[3].id,
];
starterQuiz.questions[1].correctOptionIds = [
  starterQuiz.questions[1].options[1].id,
];
