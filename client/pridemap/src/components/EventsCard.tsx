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

  if (loading || events.length === 0) return null;

  return (
    <aside className="events-card" aria-label={`Upcoming events in ${CITY_NAME}`}>
      <h2 className="events-card__title">Happening in {CITY_NAME}</h2>
      <div className="events-card__list">
        {events.map(event => (
          <div key={event.id} className="events-card__item">
            <div className="events-card__date">{formatEventDate(event)}</div>
            <div className="events-card__name">{event.title}</div>
            {event.location && (
              <div className="events-card__location">{event.location}</div>
            )}
            {event.url && (
              <a
                className="events-card__link"
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default EventsCard;
