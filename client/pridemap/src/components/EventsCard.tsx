import { useEffect, useState } from 'react';
import { CITY_NAME } from '../config';

type Event = {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  city: string;
  url: string | null;
  image_url: string | null;
};

function formatEventDate(event: Event): string {
  // node-postgres serializes a DATE column as a full ISO timestamp
  // ("2026-10-20T04:00:00.000Z"), so only the first 10 chars are the
  // YYYY-MM-DD we want. Parse as local, not UTC midnight.
  const [year, month, day] = event.event_date.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (!event.event_time) return dateLabel;

  const [hour, minute] = event.event_time.split(':').map(Number);
  const timeDate = new Date(year, month - 1, day, hour, minute);
  const timeLabel = timeDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}

const EventsCard = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events?city=${encodeURIComponent(CITY_NAME)}&limit=3`)
      .then(res => res.json())
      .then((json: Event[]) => {
        if (!cancelled) setEvents(json);
      })
      .catch(error => console.error('Error loading events:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Close the modal on Escape.
  useEffect(() => {
    if (!activeEvent) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveEvent(null);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeEvent]);

  if (loading || events.length === 0) return null;

  return (
    <aside className="events-card" aria-label={`Upcoming events in ${CITY_NAME}`}>
      <h2 className="events-card__title">Happening in {CITY_NAME}</h2>
      <div className="events-card__list">
        {events.map(event => (
          <div key={event.id} className="events-card__item" onClick={() => setActiveEvent(event)}>
            {event.image_url && (
              <img className="events-card__image" src={event.image_url} alt="" loading="lazy" />
            )}
            <div className="events-card__date">{formatEventDate(event)}</div>
            <div className="events-card__name">{event.title}</div>
            {event.location && (
              <div className="events-card__location">{event.location}</div>
            )}
            <div className="events-card__actions">
              <button
                type="button"
                className="events-card__link"
                onClick={(e) => { e.stopPropagation(); setActiveEvent(event); }}
              >
                View details
              </button>
              {event.url && (
                <a
                  className="events-card__link"
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Learn more
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeEvent && (
        <div className="event-modal-scrim" onClick={() => setActiveEvent(null)}>
          <div
            className="event-modal"
            role="dialog"
            aria-modal="true"
            aria-label={activeEvent.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="event-modal__close"
              aria-label="Close"
              onClick={() => setActiveEvent(null)}
            >
              ×
            </button>

            {activeEvent.image_url && (
              <img className="event-modal__image" src={activeEvent.image_url} alt="" />
            )}

            <div className="event-modal__body">
              <div className="events-card__date">{formatEventDate(activeEvent)}</div>
              <h3 className="event-modal__title">{activeEvent.title}</h3>
              {activeEvent.location && (
                <div className="events-card__location">{activeEvent.location}</div>
              )}
              {activeEvent.description && (
                <p className="event-modal__description">{activeEvent.description}</p>
              )}
              {activeEvent.url && (
                <a
                  className="events-card__link"
                  href={activeEvent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default EventsCard;
