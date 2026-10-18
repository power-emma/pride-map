import { useTranslation } from 'react-i18next';
import PasswordRequestForm from './PasswordRequestForm';
import type { AuthUser } from '../auth';

interface AccountPanelProps {
  user: AuthUser;
}

export default function AccountPanel({ user }: AccountPanelProps) {
  const { t } = useTranslation();

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem' }}>
      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
        <section style={{ display: 'grid', gap: '0.4rem' }}>
          <h2 style={{ margin: 0 }}>{t('account.title')}</h2>
          <div><strong>{t('login.username')}:</strong> {user.username}</div>
          <div><strong>{t('login.email')}:</strong> {user.email ?? t('users.noEmail')}</div>
          {user.isAdmin && <div style={{ opacity: 0.75 }}>{t('account.isAdmin')}</div>}
        </section>

        <section style={{ display: 'grid', gap: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>{t('account.changePassword')}</h3>
          <PasswordRequestForm username={user.username} />
        </section>
      </div>
    </div>
  );
}
