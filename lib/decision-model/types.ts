export type DecisionResult =
  | { status: 'success'; message: string }
  | { status: 'needs_clarification'; message: string };

export interface DecisionModelClient {
  readonly maxInputChars: number;
  decide(question: string): Promise<DecisionResult>;
}
