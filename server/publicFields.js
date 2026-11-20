function parsePublicFields(body, includeOrganizationFields = true) {
  const fields = {};

  if (includeOrganizationFields) {
    for (const [field, maxLength] of [['contact_email', 255], ['contact_phone', 100]]) {
      if (body?.[field] === undefined) continue;
      const value = body[field];
      if (value !== null && typeof value !== 'string') return { error: 'INVALID_PUBLIC_CONTACT' };
      const normalized = typeof value === 'string' ? value.trim() || null : null;
      if (normalized !== null && normalized.length > maxLength) return { error: 'INVALID_PUBLIC_CONTACT' };
      if (field === 'contact_email' && normalized !== null &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return { error: 'INVALID_PUBLIC_CONTACT' };
      }
      fields[field] = normalized;
    }

    if (body?.hours !== undefined) {
      const value = body.hours;
      if (value !== null && (typeof value !== 'object' || Array.isArray(value))) {
        return { error: 'INVALID_HOURS' };
      }
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const validTime = time => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
      if (value !== null && Object.entries(value).some(([day, intervals]) =>
        !days.includes(day) || !Array.isArray(intervals) ||
        intervals.some(interval =>
          !interval || typeof interval !== 'object' || Array.isArray(interval) ||
          !validTime(interval.opens) || !validTime(interval.closes) ||
          Object.keys(interval).some(key => key !== 'opens' && key !== 'closes')
        )
      )) {
        return { error: 'INVALID_HOURS' };
      }
      if (value !== null && Buffer.byteLength(JSON.stringify(value), 'utf8') > 10000) {
        return { error: 'INVALID_HOURS' };
      }
      fields.hours = value;
    }
  }

  if (body?.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > 50 ||
        body.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 100)) {
      return { error: 'INVALID_TAGS' };
    }
    fields.tags = [...new Set(body.tags.map(tag => tag.trim()))];
  }

  return { fields };
}

module.exports = { parsePublicFields };
