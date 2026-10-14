import i18n from './i18n';

const apiErrorKeys: Record<string, string> = {
  A_VALID_EMAIL_REQUIRED: 'errors.emailRequired',
  CAPTCHA_VERIFICATION_FAILED: 'errors.captchaFailed',
  CREDENTIALS_REQUIRED: 'errors.credentialsRequired',
  EVENT_NOT_FOUND: 'errors.eventNotFound',
  IMAGE_FILE_REQUIRED: 'errors.imageFileRequired',
  INTERNAL_SERVER_ERROR: 'errors.server',
  INVALID_CATEGORIES: 'errors.invalidCategories',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  INVALID_EVENT_DATE: 'errors.invalidEventDate',
  INVALID_EVENT_ID: 'errors.invalidEventId',
  INVALID_IMAGE_UPLOAD: 'errors.invalidImageUpload',
  INVALID_LATITUDE: 'errors.invalidLatitude',
  INVALID_LINKED_LOCATION: 'errors.invalidLinkedLocation',
  INVALID_LOCATION_ID: 'errors.invalidLocationId',
  INVALID_LONGITUDE: 'errors.invalidLongitude',
  INVALID_OR_EXPIRED_TOKEN: 'errors.invalidToken',
  INVALID_STATUS_FILTER: 'errors.invalidStatusFilter',
  INVALID_SUBMISSION_ID: 'errors.invalidSubmissionId',
  INVALID_SUBMISSION_STATUS: 'errors.submissionNotPending',
  IMAGE_TOO_LARGE: 'errors.imageTooLarge',
  INVALID_COORDINATES: 'errors.invalidCoordinates',
  LINKED_LOCATION_NOT_FOUND: 'errors.linkedLocationNotFound',
  LOCATION_NOT_FOUND: 'errors.locationNotFound',
  NAME_REQUIRED: 'errors.nameRequired',
  NO_EVENT_IMAGE: 'errors.noEventImage',
  NO_IMAGE_FILE: 'errors.imageFileRequired',
  NO_LOCATION_IMAGE: 'errors.noLocationImage',
  NO_SUBMISSION_IMAGE: 'errors.noSubmissionImage',
  PENDING_SUBMISSION_NOT_FOUND: 'errors.pendingSubmissionNotFound',
  SUBMISSION_NOT_FOUND: 'errors.submissionNotFound',
  SUBMISSION_RATE_LIMIT: 'errors.submissionRateLimit',
  TITLE_REQUIRED: 'errors.titleRequired',
  UNAUTHENTICATED: 'errors.authenticationRequired',
  UNSUPPORTED_IMAGE_TYPE: 'errors.unsupportedImageType',
};

export function localizedApiError(code: unknown, status?: number): string {
  if (typeof code === 'string' && apiErrorKeys[code]) {
    return i18n.t(apiErrorKeys[code]);
  }

  if (code != null) {
    console.error('Unrecognized API error code:', code);
  }

  return status == null
    ? i18n.t('errors.server')
    : i18n.t('errors.httpStatus', { status });
}
