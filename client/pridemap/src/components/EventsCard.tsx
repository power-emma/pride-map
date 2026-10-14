import { useEffect, useState } from 'react';
import '../i18n';
import { useTranslation } from 'react-i18next';
import { CITY_NAME } from '../config';

type Event = {
  id: number;
  title: string;
  title_fr?: string | null;
  description: string | null;
  description_fr?: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  city: string;
  url: string | null;
  image_url: string | null;
};

function formatEventDate(event: Event, locale: string): string {
  // node-postgres serializes a DATE column as a full ISO timestamp
  // ("2026-10-20T04:00:00.000Z"), so only the first 10 chars are the
  // YYYY-MM-DD we want. Parse as local, not UTC midnight.
  const [year, month, day] = event.event_date.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dateLabel = date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (!event.event_time) return dateLabel;

  const [hour, minute] = event.event_time.split(':').map(Number);
  const timeDate = new Date(year, month - 1, day, hour, minute);
  const timeLabel = timeDate.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}

const EventsCard = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr-CA' : 'en-CA';
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
  const localizeEvent = (event: Event) => ({
    title: locale.startsWith('fr') ? event.title_fr || event.title : event.title,
    description: locale.startsWith('fr') ? event.description_fr || event.description : event.description,
  });

  return (
    <aside className="events-card" aria-label={t('events.upcoming', { city: CITY_NAME })}>
      <h2 className="events-card__title">{t('events.happening', { city: CITY_NAME })}</h2>
      <div className="events-card__list">
        {events.map(event => (
          <div key={event.id} className="events-card__item" onClick={() => setActiveEvent(event)}>
            {event.image_url && (
              <img className="events-card__image" src={event.image_url} alt="" loading="lazy" />
            )}
            <div className="events-card__date">{formatEventDate(event, locale)}</div>
            <div className="events-card__name">{localizeEvent(event).title}</div>
            {event.location && (
              <div className="events-card__location">{event.location}</div>
            )}
            <div className="events-card__actions">
              <button
                type="button"
                className="events-card__link"
                onClick={(e) => { e.stopPropagation(); setActiveEvent(event); }}
              >
                {t('events.viewDetails')}
              </button>
              {event.url && (
                <a
                  className="events-card__link"
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('events.learnMore')}
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
            aria-label={localizeEvent(activeEvent).title}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="event-modal__close"
              aria-label={t('events.close')}
              onClick={() => setActiveEvent(null)}
            >
              ×
            </button>

            {activeEvent.image_url && (
              <img className="event-modal__image" src={activeEvent.image_url} alt="" />
            )}

            <div className="event-modal__body">
              <div className="events-card__date">{formatEventDate(activeEvent, locale)}</div>
              <h3 className="event-modal__title">{localizeEvent(activeEvent).title}</h3>
              {activeEvent.location && (
                <div className="events-card__location">{activeEvent.location}</div>
              )}
              {localizeEvent(activeEvent).description && (
                <p className="event-modal__description">{localizeEvent(activeEvent).description}</p>
              )}
              {activeEvent.url && (
                <a
                  className="events-card__link"
                  href={activeEvent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('events.learnMore')}
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
