import { onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NotificationPreferences,
    requestAndSaveNotificationToken
} from './notificationTokens';

export const requestNotificationPermission = async (
    userId: string | number,
    preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
) => {
    try {
        if (typeof Notification === 'undefined') {
            console.warn('Notifications not supported in this browser.');
            return null;
        }

        const tokenRecord = await requestAndSaveNotificationToken(Number(userId), preferences);
        if (!tokenRecord) {
            console.warn('No registration token available. Request permission to generate one.');
            return null;
        }

        return tokenRecord.token;
    } catch (error) {
        console.error('An error occurred while retrieving token:', error);
        throw error;
    }
};

export const setupOnMessage = (callback: (payload: any) => void) => {
    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    getFirebaseMessaging().then((messaging) => {
        if (!isActive || !messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
            callback(payload);
        });
    }).catch((error) => {
        console.error('Erro ao configurar listener de notificações:', error);
    });

    return () => {
        isActive = false;
        unsubscribe?.();
    };
};
