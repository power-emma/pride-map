type LocationSidebarItem = {
  name: string;
  categories?: string[];
  description?: string | null;
  address?: string | null;
  url?: string | null;
};

const LocationSidebar = ({
  location,
  onClose,
}: {
  location: LocationSidebarItem | null;
  onClose: () => void;
}) => {
  if (!location) {
    return null;
  }

  const categories = location.categories?.length ? location.categories : ['Uncategorized'];

  return (
    <aside className="location-sidebar" aria-label="Location details">
      <button
        type="button"
        className="location-sidebar__close"
        aria-label="Close location details"
        onClick={onClose}
      >
        ×
      </button>

      <div className="location-sidebar__content">
        <h2 className="location-sidebar__title">{location.name}</h2>

        <div className="location-sidebar__tags" aria-label="Location categories">
          {categories.map((category) => (
            <span key={category} className="location-sidebar__tag">
              {category}
            </span>
          ))}
        </div>

        <section className="location-sidebar__section">
          <h3>About</h3>
          <p>{location.description || 'No description available.'}</p>
        </section>

        <section className="location-sidebar__section">
          <h3>Contact</h3>
          {location.address && (
            <div className="location-sidebar__row">
              <span className="location-sidebar__label">Address</span>
              <p>{location.address}</p>
            </div>
          )}

          {location.url ? (
            <div className="location-sidebar__row">
              <span className="location-sidebar__label">Website</span>
              <a href={location.url} target="_blank" rel="noopener noreferrer">
                {location.url}
              </a>
            </div>
          ) : (
            <div className="location-sidebar__row">
              <span className="location-sidebar__label">Website</span>
              <p>No website provided.</p>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};

export type { LocationSidebarItem };
export default LocationSidebar;
