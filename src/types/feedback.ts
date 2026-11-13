export type FeedbackFormStatus = "DRAFT" | "OPEN" | "CLOSED";

export type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "RATING"
  | "SHORT_TEXT"
  | "LONG_TEXT";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTI_CHOICE: "Multiple choice",
  RATING: "Rating (1-5)",
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
};

export const STATUS_LABELS: Record<FeedbackFormStatus, string> = {
  DRAFT: "Draft (hidden)",
  OPEN: "Open (accepting answers)",
  CLOSED: "Closed (visible, no new answers)",
};

export const RATING_VALUES = [1, 2, 3, 4, 5] as const;
export const SHORT_TEXT_MAX = 500;
export const LONG_TEXT_MAX = 5000;
export const RESPONDENT_MAX = 100;

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface RatingConfig {
  minLabel?: string;
  maxLabel?: string;
}

export interface FeedbackQuestion {
  id: string;
  formId: string;
  position: number;
  type: QuestionType;
  label: string;
  description: string | null;
  required: boolean;
  options: ChoiceOption[] | null;
  config: RatingConfig | null;
  archived: boolean;
}

export interface AdminFeedbackQuestion extends FeedbackQuestion {
  answerCount: number;
}

export type QuestionInput = Pick<
  FeedbackQuestion,
  "type" | "label" | "description" | "required" | "options" | "config"
> & { archived?: boolean };

export interface FeedbackFormSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
}

export interface FeedbackForm extends FeedbackFormSummary {
  status: FeedbackFormStatus;
  // Only enforced by the browser: responses are anonymous.
  allowMultipleResponses: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicFeedbackForm extends FeedbackForm {
  questions: FeedbackQuestion[];
}

export interface AdminFeedbackForm extends FeedbackForm {
  questions: AdminFeedbackQuestion[];
}

export interface FeedbackFormListItem extends FeedbackForm {
  responseCount: number;
  questionCount: number;
}

export interface FormInput {
  title: string;
  slug?: string;
  description: string;
  status?: FeedbackFormStatus;
  allowMultipleResponses?: boolean;
}

// string: choice id or text, string[]: multi choice ids, number: rating
export type AnswerValue = string | string[] | number;
export type Answers = Record<string, AnswerValue>;

export type QuestionStats =
  | {
      kind: "choice";
      answered: number;
      counts: { optionId: string; label: string; count: number }[];
    }
  | {
      kind: "rating";
      answered: number;
      distribution: number[];
      mean: number | null;
    }
  | {
      kind: "text";
      answered: number;
      latest: { responseId: string; createdAt: string; value: string }[];
    };

export interface FormStats {
  form: Pick<FeedbackForm, "id" | "slug" | "title" | "status">;
  totalResponses: number;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  perDay: { date: string; count: number }[];
  questions: { question: FeedbackQuestion; stats: QuestionStats }[];
}

export interface FeedbackResponseRow {
  id: string;
  createdAt: string;
  respondent: string | null;
  answers: Answers;
}

export interface ResponsesPage {
  total: number;
  page: number;
  pageSize: number;
  items: FeedbackResponseRow[];
}
