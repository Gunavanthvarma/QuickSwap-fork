import { useState, useEffect } from 'react';
import { getApiUrl } from '../lib/api';

export function ApiOfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const checkHealth = async () => {
      try {
        const res = await fetch(getApiUrl('/api/health'));
        if (!res.ok) throw new Error("API Down");
        if (mounted) setIsOffline(false);
      } catch (err) {
        if (mounted) setIsOffline(true);
      }
    };

    // Check immediately, then every 10 seconds
    checkHealth();
    const interval = setInterval(checkHealth, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={{
      backgroundColor: '#ef4444',
      color: 'white',
      textAlign: 'center',
      padding: '8px',
      fontSize: '14px',
      fontWeight: 500,
      position: 'sticky',
      top: 0,
      zIndex: 9999,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    }}>
      ⚠️ QuickSwap API is currently offline. Please wait while the cloud server wakes up.
    </div>
  );
}
