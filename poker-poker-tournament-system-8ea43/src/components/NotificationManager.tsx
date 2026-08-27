import { useEffect, useState } from 'react';
import { requestPermission, listenForMessages, unregisterToken } from '../lib/fcm';
import { useAuth } from '../lib/auth';
import { Btn, Icon, Toggle } from './ui';

export function NotificationManager() {
  const user = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem('notifications-enabled') === 'true'
  );

  useEffect(() => {
    if (notificationsEnabled && user) {
      requestPermission();
      listenForMessages();
    }
  }, [notificationsEnabled, user]);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      console.log('Получено уведомление в React:', e.detail);
    };
    window.addEventListener('fcm-message', handler as EventListener);
    return () => window.removeEventListener('fcm-message', handler as EventListener);
  }, []);

  const toggleNotifications = async () => {
    const newState = !notificationsEnabled;
    if (!newState && user) {
      await unregisterToken();
    }
    setNotificationsEnabled(newState);
    localStorage.setItem('notifications-enabled', String(newState));
  };

  return (
    <div className="flex items-center gap-3">
      <Toggle
        checked={notificationsEnabled}
        onChange={toggleNotifications}
        label={
          <span className="flex items-center gap-2">
            <Icon name="bell" size={16} />
            <span className="text-sm">Уведомления</span>
          </span>
        }
        disabled={!user}
      />
    </div>
  );
}