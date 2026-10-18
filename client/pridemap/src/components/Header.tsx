import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
    authToken?: string | null;
    /** Admins see "Admin dashboard" instead of "My dashboard". */
    isAdmin?: boolean;
    onLogout?: () => void;
    children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ authToken, isAdmin = false, onLogout, children }) => {
    const { t, i18n: locale } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    // Close the menu on an outside click or Escape.
    useEffect(() => {
        if (!menuOpen) return;
        function handlePointerDown(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setMenuOpen(false);
        }
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [menuOpen]);

    return (
        <header className="site-header">
            <div className="site-header__left">
                <Link to="/" className="site-header__title">Queer Atlas</Link>
                {children}
            </div>
            <div className="site-header__menu" ref={menuRef}>
                <button
                    type="button"
                    className="site-header__menu-toggle"
                    aria-label={t('header.menu')}
                    aria-haspopup="true"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(open => !open)}
                >
                    <span className="site-header__menu-bars" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </span>
                </button>
                {menuOpen && (
                    <nav className="site-header__dropdown">
                        <Link
                            to="/create-location"
                            className="site-header__dropdown-item"
                            onClick={() => setMenuOpen(false)}
                        >
                            {t('header.submitBusiness')}
                        </Link>
                        <Link
                            to="/manage-locations"
                            className="site-header__dropdown-item"
                            onClick={() => setMenuOpen(false)}
                        >
                            {authToken
                                ? (isAdmin ? t('header.adminDashboard') : t('header.myDashboard'))
                                : t('header.signIn')}
                        </Link>
                        {authToken && onLogout && (
                            <button
                                type="button"
                                className="site-header__dropdown-item"
                                onClick={() => { setMenuOpen(false); onLogout(); }}
                            >
                                {t('header.signOut')}
                            </button>
                        )}
                        <button
                            type="button"
                            className="site-header__dropdown-item"
                            aria-label={locale.language.startsWith('fr') ? t('header.switchToEnglish') : t('header.switchToFrench')}
                            onClick={() => { void locale.changeLanguage(locale.language.startsWith('fr') ? 'en' : 'fr'); }}
                        >
                            {locale.language.startsWith('fr') ? t('header.english') : t('header.french')}
                        </button>
                    </nav>
                )}
            </div>
        </header>
    );
};

export default Header;
