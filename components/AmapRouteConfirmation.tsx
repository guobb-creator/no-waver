'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildAmapMobileIframeUrl, buildAmapNavigationUrl } from '@/lib/route-confirmation/amap-uri';
import type { RouteConfirmation, RouteConfirmationCandidate, RouteConfirmationMode } from '@/lib/route-confirmation/types';

type AmapRouteConfirmationProps = {
  data: RouteConfirmation;
};

const modeLabels: Record<RouteConfirmationMode, string> = {
  transit: '公交/地铁',
  driving: '驾车/打车',
  cycling: '骑行',
  walking: '步行',
};

const modeOrder: RouteConfirmationMode[] = ['transit', 'driving', 'cycling', 'walking'];

export function AmapRouteConfirmation({ data }: AmapRouteConfirmationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(data.defaultCandidateId);
  const [frameStatus, setFrameStatus] = useState<'loading' | 'loaded' | 'slow'>('loading');
  const [frameRetryKey, setFrameRetryKey] = useState(0);
  const selectedCandidate = data.candidates.find((candidate) => candidate.id === selectedCandidateId) || data.candidates[0];
  const [selectedMode, setSelectedMode] = useState<RouteConfirmationMode>(() =>
    pickAvailableMode(selectedCandidate, data.defaultMode),
  );

  const activeMode = pickAvailableMode(selectedCandidate, selectedMode);

  const iframeUrl = useMemo(
    () => buildAmapMobileIframeUrl({ origin: data.origin, destination: selectedCandidate, mode: activeMode }),
    [activeMode, data.origin, selectedCandidate],
  );
  const navigationUrl = useMemo(
    () =>
      buildAmapNavigationUrl({
        origin: data.origin,
        destination: selectedCandidate,
        mode: activeMode,
        callnative: true,
      }),
    [activeMode, data.origin, selectedCandidate],
  );

  function selectCandidate(candidate: RouteConfirmationCandidate) {
    setSelectedCandidateId(candidate.id);
    setSelectedMode((currentMode) => pickAvailableMode(candidate, currentMode));
  }

  useEffect(() => {
    if (!isExpanded) return undefined;

    setFrameStatus('loading');
    const timeout = window.setTimeout(() => {
      setFrameStatus((current) => (current === 'loading' ? 'slow' : current));
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [activeMode, iframeUrl, isExpanded, selectedCandidate.id, frameRetryKey]);

  return (
    <section className="amap-confirmation" aria-labelledby="amap-confirmation-title">
      <div className="amap-confirmation__summary">
        <div>
          <h2 id="amap-confirmation-title">高德路线确认</h2>
          <p>{data.notice}</p>
        </div>
        <button
          className="amap-confirmation__toggle"
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? '收起高德路线' : '查看高德路线'}
        </button>
      </div>

      {isExpanded && (
        <div className="amap-confirmation__body">
          <div className="amap-confirmation__tabs" aria-label="候选目的地">
            {data.candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={
                  candidate.id === selectedCandidate.id
                    ? 'amap-confirmation__tab amap-confirmation__tab--active'
                    : 'amap-confirmation__tab'
                }
                aria-pressed={candidate.id === selectedCandidate.id}
                onClick={() => selectCandidate(candidate)}
              >
                {candidate.name}
              </button>
            ))}
          </div>

          <div className="amap-confirmation__tabs" aria-label="交通方式">
            {modeOrder
              .filter((mode) => selectedCandidate.availableModes.includes(mode))
              .map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    mode === activeMode
                      ? 'amap-confirmation__tab amap-confirmation__tab--active'
                      : 'amap-confirmation__tab'
                  }
                  aria-pressed={mode === activeMode}
                  onClick={() => setSelectedMode(mode)}
                >
                  {modeLabels[mode]}
                </button>
              ))}
          </div>

          <div className="amap-confirmation__frame-wrap">
            {frameStatus === 'loading' && <p className="amap-confirmation__status">正在加载高德路线…</p>}
            {frameStatus === 'slow' && (
              <div className="amap-confirmation__status amap-confirmation__status--slow">
                <p>高德路线加载较慢，可以重试一次。</p>
                <button type="button" onClick={() => setFrameRetryKey((current) => current + 1)}>
                  重新加载路线
                </button>
              </div>
            )}
            <iframe
              key={`${iframeUrl}-${frameRetryKey}`}
              className="amap-confirmation__iframe"
              title={`${selectedCandidate.name}${modeLabels[activeMode]}高德路线`}
              src={iframeUrl}
              loading="lazy"
              onLoad={() => setFrameStatus('loaded')}
            />
          </div>

          <a className="amap-confirmation__link" href={navigationUrl} target="_blank" rel="noreferrer">
            打开高德地图导航
          </a>
        </div>
      )}
    </section>
  );
}

function pickAvailableMode(
  candidate: RouteConfirmationCandidate,
  preferredMode: RouteConfirmationMode,
): RouteConfirmationMode {
  if (candidate.availableModes.includes(preferredMode)) return preferredMode;
  return candidate.availableModes[0];
}
