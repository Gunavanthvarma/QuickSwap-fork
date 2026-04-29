import { useEffect, useState } from 'react';
import { parseAuctionEndMsFromListing, remainingUntilEndMs, formatCountdown } from '../auction/auctionCountdown';

interface CountdownTimerProps {
  endTimeIso: string;
  className?: string;
}

export function CountdownTimer({ endTimeIso, className }: CountdownTimerProps) {
  const endMs = parseAuctionEndMsFromListing(endTimeIso);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (endMs == null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endMs]);

  if (endMs == null) return null;
  const remaining = remainingUntilEndMs(endMs, nowMs, null);
  return <span className={className ?? 'countdown-timer'} aria-live="polite">{formatCountdown(remaining)}</span>;
}
