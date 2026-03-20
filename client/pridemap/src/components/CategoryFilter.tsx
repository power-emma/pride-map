import { CATEGORY_COLOURS, DEFAULT_COLOUR } from '../categoryColours';

const ALL_CATEGORIES = Object.keys(CATEGORY_COLOURS).sort();

const CategoryFilter = ({
    selected,
    onChange,
}: {
    selected: string | null;
    onChange: (category: string | null) => void;
}) => {
    const activeColour = selected ? CATEGORY_COLOURS[selected]?.border : DEFAULT_COLOUR.border;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: '20px 0 12px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
            <label
                htmlFor="category-filter"
                style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}
            >
                Filter by category:
            </label>
            <select
                id="category-filter"
                value={selected ?? ''}
                onChange={e => onChange(e.target.value || null)}
                style={{
                    backgroundColor: '#1e1e2e',
                    color: '#ffffff',
                    border: `1px solid ${activeColour}`,
                    borderRadius: '6px',
                    padding: '6px 32px 6px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23aaa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    minWidth: '220px',
                    transition: 'border-color 0.15s',
                }}
            >
                <option value="">All categories</option>
                {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
            </select>
        </div>
    );
};

export default CategoryFilter;
