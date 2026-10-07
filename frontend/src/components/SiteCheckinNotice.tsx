import { useEffect, useState } from 'react';
import { apiCheckinAvailability } from '../api/client';

export function SiteCheckinNotice({ siteId }: { siteId: string }) {
  const [enabledId, setEnabledId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiCheckinAvailability(siteId).then(enabled => { if (!cancelled) setEnabledId(enabled ? siteId : null); }).catch(() => { if (!cancelled) setEnabledId(null); });
    return () => { cancelled = true; };
  }, [siteId]);
  if (enabledId !== siteId) return null;
  return <aside className="rounded-lg border border-[#e8dfd5] bg-[#faf2ee] p-4"><h2 className="font-bold">Heritage Passport</h2><p>Visit the site and scan its official QR to earn the stamp.</p></aside>;
}
