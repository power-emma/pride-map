import '../App.css';

const Header = () => {
    return (
        <header className="header">
            <div className="header-left">
                <img src="/src/assets/logo.png" alt="Pride Map Logo" className="logo" />
                <h1>Welcome to Pride Map</h1>
            </div>
            <button className="header-button">Menu</button>
        </header>
    );
};

export default Header;