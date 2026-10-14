import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { translateCategory } from '../categoryTranslations';

type LocationSidebarItem = {
  name: string;
  nameFr?: string | null;
  categories?: string[];
  description?: string | null;
  descriptionFr?: string | null;
  address?: string | null;
  url?: string | null;
  imageUrl?: string | null;
};

const LocationSidebar = ({
  location,
  onClose,
}: {
  location: LocationSidebarItem | null;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const [closingLocation, setClosingLocation] = useState<LocationSidebarItem | null>(null);

  if (!location) {
    return null;
  }

  const categories = location.categories?.length ? location.categories : [t('sidebar.uncategorized')];
  const isFrench = i18n.language.startsWith('fr');
  const isClosing = closingLocation === location;

  const handleClose = () => {
    setClosingLocation(location);
    window.setTimeout(() => {
      onClose();
    }, 180);
  };

  return (
    <aside className={`location-sidebar ${isClosing ? 'location-sidebar--closing' : ''}`} aria-label={t('sidebar.locationDetails')}>
      <button
        type="button"
        className="location-sidebar__close"
        aria-label={t('sidebar.close')}
        onClick={handleClose}
      >
        ×
      </button>

      <div className="location-sidebar__content">
        {location.imageUrl && (
          <img className="location-sidebar__image" src={location.imageUrl} alt="" />
        )}
        <h2 className="location-sidebar__title">{isFrench ? location.nameFr || location.name : location.name}</h2>

        <div className="location-sidebar__tags" aria-label={t('sidebar.categories')}>
          {categories.map((category) => (
            <span key={category} className="location-sidebar__tag">
              {translateCategory(category, t)}
            </span>
          ))}
        </div>

        <section className="location-sidebar__section">
          <h2>{t('sidebar.about')}</h2>
          <p>{(isFrench ? location.descriptionFr || location.description : location.description) || t('sidebar.noDescription')}</p>
        </section>

        <section className="location-sidebar__section">
          <h2>{t('sidebar.contact')}</h2>
          {location.address ? (
            <div className="location-sidebar__row">
              <span className="location-sidebar__label">{t('sidebar.address')}</span>
              <p>{location.address}</p>
            </div>
          ) : (
            <div className="location-sidebar__row">
              <span className="location-sidebar__label">{t('sidebar.address')}</span>
              <p>{t('sidebar.noAddress')}</p>
            </div>
          )}

          {location.url ? (
            <div className="location-sidebar__row">
              <span className="location-sidebar__label">{t('sidebar.website')}</span>
              <a href={location.url} target="_blank" rel="noopener noreferrer">
                {location.url}
              </a>
            </div>
          ) : (
            <div className="location-sidebar__row">
              <span className="location-sidebar__label">{t('sidebar.website')}</span>
              <p>{t('sidebar.noWebsite')}</p>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};

export type { LocationSidebarItem };
export default LocationSidebar;
