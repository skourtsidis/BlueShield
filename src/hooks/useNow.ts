import { useEffect, useState } from 'react';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(i);
  }, [ms]);
  return now;
}
