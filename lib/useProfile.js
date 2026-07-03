'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Loads the logged-in user's profile (role, state_id, edition_id).
// Returns { loading, user, profile }.
export function useProfile() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) { setLoading(false); }
        return;
      }
      setUser(session.user);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*, states(name)')
        .eq('id', session.user.id)
        .single();
      if (!error && mounted) setProfile(profileData);
      if (mounted) setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setProfile(null);
      } else {
        load();
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return { loading, user, profile };
}
