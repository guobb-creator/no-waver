import type { TrafficSummary } from '@/lib/traffic-summary/types';

type TrafficSummaryCardProps = {
  summary: TrafficSummary;
};

export function TrafficSummaryCard({ summary }: TrafficSummaryCardProps) {
  return (
    <section className="traffic-summary" aria-labelledby="traffic-summary-title">
      <div className="traffic-summary__header">
        <div>
          <h2 id="traffic-summary-title">交通对比</h2>
          <p>
            数据来源：{summary.source} · {summary.queriedAtText}
          </p>
        </div>
        <p className="traffic-summary__origin">
          从 <span>{summary.origin.resolvedName || summary.origin.name}</span> 出发
        </p>
      </div>

      <div className="traffic-summary__candidates">
        {summary.candidates.map((candidate) => (
          <article className="traffic-card" key={candidate.id}>
            <header>
              <h3>{candidate.name}</h3>
              {candidate.resolvedName && candidate.resolvedName !== candidate.name && (
                <p>高德识别为：{candidate.resolvedName}</p>
              )}
            </header>
            <div className="traffic-card__routes">
              {candidate.routes.map((route) => (
                <div className="traffic-route" key={`${candidate.id}-${route.mode}`}>
                  <div className="traffic-route__main">
                    <span className="traffic-route__mode">{route.label}</span>
                    <span className="traffic-route__duration">{route.durationText}</span>
                    {route.distanceText && <span>{route.distanceText}</span>}
                  </div>
                  <div className="traffic-route__meta">
                    {route.lineNamesText && <span>{route.lineNamesText}</span>}
                    {route.walkingDistanceText && <span>{route.walkingDistanceText}</span>}
                    {route.transfersText && <span>{route.transfersText}</span>}
                    {route.note && <span>{route.note}</span>}
                  </div>
                  <a className="traffic-route__link" href={route.verificationUrl} target="_blank" rel="noreferrer">
                    高德查看
                  </a>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className="traffic-insight" aria-labelledby="traffic-insight-title">
        <h3 id="traffic-insight-title">交通判断：{summary.trafficInsight.title}</h3>
        <ul>
          {summary.trafficInsight.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>

      <p className="traffic-summary__notice">{summary.notice}</p>
    </section>
  );
}
