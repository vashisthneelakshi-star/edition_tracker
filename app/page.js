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
          Aapka account bana hai lekin role assign nahi hua.
          Admin se contact kariye.
        </div>
      </div>
    );
  }
  return <div className="container">Redirecting...</div>;
}
