import styles from "./ExampleQuestions.module.scss";

export const EXAMPLE_QUESTIONS = [
  "“What have I saved about sleep?”",
  "“Across my overviews on housing, where do the speakers disagree?”",
  "“Which video explained index funds, and what was its verdict?”",
];

export interface ExampleQuestionsProps {
  onTint?: boolean;
}

export function ExampleQuestions({ onTint = false }: ExampleQuestionsProps) {
  return (
    <ul className={`${styles.root} ${onTint ? styles.onTint : ""}`} aria-label="Example questions">
      {EXAMPLE_QUESTIONS.map((question) => (
        <li key={question} className={styles.question}>
          {question}
        </li>
      ))}
    </ul>
  );
}
