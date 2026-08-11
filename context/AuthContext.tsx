
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PASSWORD_RECOVERY_FLAG = 'passwordRecoveryInProgress';

const isPasswordRecoveryUrl = () => {
    const locationText = `${window.location.href} ${window.location.hash} ${window.location.search}`;
    return locationText.includes('type=recovery') || locationText.includes('type%3Drecovery');
};

const navigateToPasswordRecovery = () => {
    sessionStorage.setItem(PASSWORD_RECOVERY_FLAG, 'true');

    if (window.location.hash !== '#/update-password') {
        window.location.hash = '/update-password';
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isPasswordRecoveryUrl()) {
            sessionStorage.setItem(PASSWORD_RECOVERY_FLAG, 'true');
        }

        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session && sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === 'true') {
                navigateToPasswordRecovery();
            }

            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (
                event === 'PASSWORD_RECOVERY' ||
                (session && sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === 'true')
            ) {
                navigateToPasswordRecovery();
            }

            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (authId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, profile_chapters(permission_slug, chapter_id, role)')
                .eq('auth_id', authId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
            }

            if (data) {
                // Map any necessary legacy fields or hydration if needed immediately
                // For now, raw data is fine for simple display
                setProfile({
                    ...(data as any),
                    profileChapters: (data as any).profile_chapters
                } as any);
            }
        } catch (error) {
            console.error('Unexpected error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshProfile = async () => {
        if (user?.id) {
            await fetchProfile(user.id);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
