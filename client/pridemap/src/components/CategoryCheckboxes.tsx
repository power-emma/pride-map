import React from 'react';

type Category = { id: number; name: string };

interface Props {
  categories: Category[];
  loading: boolean;
  selected: number[];
  onChange: (ids: number[]) => void;
}

const CategoryCheckboxes: React.FC<Props> = ({ categories, loading, selected, onChange }) => {
  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (loading) return <div style={{ opacity: 0.6, fontSize: 14 }}>Loading categories…</div>;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '0.35rem 1rem',
      padding: '0.5rem',
      border: '1px solid #444',
      borderRadius: 8,
      maxHeight: 200,
      overflowY: 'auto',
    }}>
      {categories.map(c => (
        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() => toggle(c.id)}
          />
          {c.name}
        </label>
      ))}
    </div>
  );
};

export default CategoryCheckboxes;
