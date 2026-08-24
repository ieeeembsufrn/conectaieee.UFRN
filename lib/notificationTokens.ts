import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
import { supabase } from './supabase';

export interface NotificationPreferences {
  notify_due_tasks: boolean;
  notify_overdue_tasks: boolean;
  notify_chapter_events: boolean;
  notify_new_assignments: boolean;
}

export interface NotificationTokenRecord extends NotificationPreferences {
  id: number;
  profile_id: number;
  token: string;
  enabled: boolean;
  platform?: string | null;
  user_agent?: string | null;
  last_seen_at?: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notify_due_tasks: true,
  notify_overdue_tasks: true,
  notify_chapter_events: true,
  notify_new_assignments: true
};

const NOTIFICATION_TOKEN_SELECT = `
  id,
  profile_id,
  token,
  enabled,
  platform,
  user_agent,
  last_seen_at,
  notify_due_tasks,
  notify_overdue_tasks,
  notify_chapter_events,
  notify_new_assignments
`;

export const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isStandalonePwa = () => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
};

export const isMobilePwaDevice = () => isMobileDevice() && isStandalonePwa();

const getDevicePlatform = () => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return 'unknown';
  }

  const isMobile = isMobileDevice();
  const isPWA = isStandalonePwa();
  return `${isMobile ? 'mobile' : 'desktop'}${isPWA ? '-pwa' : '-browser'}`;
};

const getServiceWorkerRegistration = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker não está disponível neste navegador.');
  }

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error('Service Worker registration timed out')), 5000)
    )
  ]);
};

export const getCurrentFcmToken = async (requestPermission = false) => {
  if (typeof Notification === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('Notificações não estão disponíveis neste navegador.');
  }

  let permission = Notification.permission;
  if (requestPermission && permission !== 'granted') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    throw new Error('Permissão de notificação não foi concedida neste navegador.');
  }

  const messaging = await getFirebaseMessaging();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!messaging) {
    throw new Error('Este navegador não suporta Firebase Cloud Messaging.');
  }

  if (!vapidKey) {
    throw new Error('Configure VITE_FIREBASE_VAPID_KEY no ambiente do app para gerar o token de notificação.');
  }

  const registration = await getServiceWorkerRegistration();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error('O Firebase não retornou um token para este navegador.');
  }

  return token;
};

export const saveNotificationToken = async (
  profileId: number,
  token: string,
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
) => {
  const { data, error } = await supabase.rpc('upsert_own_notification_token', {
    token_value: token,
    platform_value: getDevicePlatform(),
    user_agent_value: navigator.userAgent,
    enabled_value: true,
    notify_due_tasks_value: preferences.notify_due_tasks,
    notify_overdue_tasks_value: preferences.notify_overdue_tasks,
    notify_chapter_events_value: preferences.notify_chapter_events,
    notify_new_assignments_value: preferences.notify_new_assignments
  });

  if (error) throw error;
  const tokenRecord = data as NotificationTokenRecord;
  if (tokenRecord.profile_id !== profileId) {
    throw new Error('Token de notificação foi vinculado a outro perfil autenticado.');
  }

  return tokenRecord;
};

export const requestAndSaveNotificationToken = async (
  profileId: number,
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
) => {
  const token = await getCurrentFcmToken(true);
  return saveNotificationToken(profileId, token, preferences);
};

export const getCurrentNotificationTokenRecord = async (profileId: number) => {
  const token = await getCurrentFcmToken(false);
  if (!token) return null;

  const { data, error } = await supabase
    .from('notification_tokens')
    .select(NOTIFICATION_TOKEN_SELECT)
    .eq('profile_id', profileId)
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  return data as NotificationTokenRecord | null;
};

export const updateCurrentNotificationPreferences = async (
  profileId: number,
  preferences: NotificationPreferences
) => {
  const token = await getCurrentFcmToken(false);
  if (!token) {
    return null;
  }

  const { data, error } = await supabase
    .from('notification_tokens')
    .update({
      ...preferences,
      enabled: true,
      last_seen_at: new Date().toISOString()
    })
    .eq('profile_id', profileId)
    .eq('token', token)
    .select(NOTIFICATION_TOKEN_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data as NotificationTokenRecord | null;
};

export const disableCurrentNotificationToken = async (profileId: number) => {
  const token = await getCurrentFcmToken(false);
  if (!token) {
    return null;
  }

  const { data, error } = await supabase
    .from('notification_tokens')
    .update({
      enabled: false,
      last_seen_at: new Date().toISOString()
    })
    .eq('profile_id', profileId)
    .eq('token', token)
    .select(NOTIFICATION_TOKEN_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data as NotificationTokenRecord | null;
};
