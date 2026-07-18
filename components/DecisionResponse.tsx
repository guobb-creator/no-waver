type ResponseKind = 'success' | 'needs_clarification' | 'error';

type DecisionResponseProps = {
  kind: ResponseKind;
  message: string;
};

export function DecisionResponse({ kind, message }: DecisionResponseProps) {
  const title =
    kind === 'success' ? '给你的建议' : kind === 'needs_clarification' ? '请补充地点信息' : '暂时无法完成';

  return (
    <section className={`response response--${kind}`} aria-live="polite">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}
