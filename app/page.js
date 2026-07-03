'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '../lib/useProfile';

export default function HomePage() {
  const { loading, user, profile } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!profile) return; // profile still loading or not set up yet

    if (profile.role === 'edition_incharge') router.push('/entry');
    else router.push('/dashboard');
  }, [loading, user, profile, router]);

  if (loading) return <div className="container">Loading...</div>;
  if (user && !profile) {
    return (
      <div className="container">
        <div className="card">
          Your account exists but no role has been assigned yet.
          Please contact your Admin.
        </div>
      </div>
    );
  }
  return <div className="container">Redirecting...</div>;
}
