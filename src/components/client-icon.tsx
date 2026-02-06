'use client';

import { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ClientIconProps {
  icon: LucideIcon;
  className?: string;
}

export function ClientIcon({ icon: Icon, className }: ClientIconProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className={className} />;
  }

  return <Icon className={className} />;
}
