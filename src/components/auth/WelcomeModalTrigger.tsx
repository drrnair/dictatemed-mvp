'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { WelcomeModal } from './WelcomeModal';

export function WelcomeModalTrigger() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showWelcome = searchParams.get('welcome') === 'true';

  const handleClose = () => {
    // Remove query param without page reload
    router.replace('/dashboard', { scroll: false });
  };

  return <WelcomeModal isOpen={showWelcome} onClose={handleClose} />;
}
