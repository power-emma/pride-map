import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyboardEvent } from 'react';
import type { Region } from '../regions';

export default function RegionSelector({ regions, selectedRegionId, onChange }: {
  regions: Region[];
  selectedRegionId: number | null;
  onChange: (regionId: number) => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRegion = regions.find(region => region.id === selectedRegionId);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredRegions = regions.filter(region =>
    region.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isOpen]);

  function selectRegion(region: Region) {
    onChange(region.id);
    setQuery('');
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => Math.min(index + 1, filteredRegions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && isOpen && filteredRegions[activeIndex]) {
      event.preventDefault();
      selectRegion(filteredRegions[activeIndex]);
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="region-selector" ref={containerRef}>
      <label className="visually-hidden" htmlFor="region-selector-input">
        {t('regions.selectRegion')}
      </label>
      <div className="region-selector__control">
        <input
          ref={inputRef}
          id="region-selector-input"
          type="text"
          role="combobox"
          aria-label={t('regions.selectRegion')}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="available-regions"
          aria-activedescendant={isOpen && filteredRegions[activeIndex] ? `region-option-${filteredRegions[activeIndex].id}` : undefined}
          placeholder={t('regions.selectRegion')}
          value={isOpen ? query : selectedRegion?.name ?? ''}
          onFocus={() => {
            setQuery('');
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onChange={event => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={event => {
            if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
              setIsOpen(false);
              setQuery('');
            }
          }}
        />
        <button
          type="button"
          className="region-selector__toggle"
          aria-label={t('regions.selectRegion')}
          aria-expanded={isOpen}
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
              setQuery('');
            } else {
              setQuery('');
              setActiveIndex(0);
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      {isOpen && (
        <div className="region-selector__options" id="available-regions" role="listbox" aria-label={t('regions.selectRegion')}>
          {filteredRegions.length > 0 ? filteredRegions.map((region, index) => (
            <button
              key={region.id}
              id={`region-option-${region.id}`}
              role="option"
              aria-selected={region.id === selectedRegionId}
              className={index === activeIndex ? 'region-selector__option region-selector__option--active' : 'region-selector__option'}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectRegion(region)}
            >
              {region.name}
            </button>
          )) : (
            <div className="region-selector__empty">
              {regions.length === 0 ? t('regions.noRegions') : t('regions.noMatchingRegions')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
