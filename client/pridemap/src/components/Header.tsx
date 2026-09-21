import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
    authToken?: string | null;
    onLogout?: () => void;
    children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ authToken, onLogout, children }) => {
    return (
        <header className="site-header">
            <div className="site-header__left">
                <Link to="/" className="site-header__title">Queer Atlas</Link>
                {children}
            </div>
            <nav className="site-header__nav">
                <Link to="/manage-locations" className="site-header__btn">Manage Locations</Link>
                {authToken && onLogout && (
                    <button
                        onClick={onLogout}
                        className="site-header__btn"
                    >
                        Sign out
                    </button>
                )}
            </nav>
        </header>
    );
};

export default Header;
