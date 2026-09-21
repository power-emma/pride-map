import { useEffect, useRef, useState } from 'react';
import { CATEGORY_COLOURS, DEFAULT_COLOUR } from '../categoryColours';

const ALL_CATEGORIES = Object.keys(CATEGORY_COLOURS).sort();

const SearchBar = ({
    query,
    onQueryChange,
    selectedCategory,
    onCategoryChange,
}: {
    query: string;
    onQueryChange: (value: string) => void;
    selectedCategory: string | null;
    onCategoryChange: (category: string | null) => void;
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const handleSelectCategory = (category: string | null) => {
        onCategoryChange(category);
        setOpen(false);
    };

    return (
        <div className="search-bar" ref={containerRef}>
            <div className="search-bar__input-row">
                <span className="search-bar__icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </span>
                <input
                    type="text"
                    className="search-bar__input"
                    placeholder="Search places…"
                    value={query}
                    onChange={e => onQueryChange(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onClick={() => setOpen(true)}
                    aria-expanded={open}
                    aria-label="Search places"
                />
                {query && (
                    <button
                        type="button"
                        className="search-bar__clear"
                        aria-label="Clear search"
                        onClick={() => onQueryChange('')}
                    >
                        ×
                    </button>
                )}
            </div>

            {open && (
                <div className="search-bar__panel" role="listbox" aria-label="Filter by category">
                    <span className="search-bar__panel-label">Filter by category</span>
                    <button
                        type="button"
                        className={`search-bar__category ${selectedCategory === null ? 'search-bar__category--active' : ''}`}
                        onClick={() => handleSelectCategory(null)}
                    >
                        <span className="search-bar__dot" style={{ background: DEFAULT_COLOUR.border }} />
                        All categories
                    </button>
                    {ALL_CATEGORIES.map(category => {
                        const colour = CATEGORY_COLOURS[category] ?? DEFAULT_COLOUR;
                        const active = selectedCategory === category;
                        return (
                            <button
                                key={category}
                                type="button"
                                className={`search-bar__category ${active ? 'search-bar__category--active' : ''}`}
                                onClick={() => handleSelectCategory(category)}
                            >
                                <span className="search-bar__dot" style={{ background: colour.border }} />
                                {category}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
