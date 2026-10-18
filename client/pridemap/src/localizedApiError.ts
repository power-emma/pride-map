import i18n from './i18n';

const apiErrorKeys: Record<string, string> = {
  A_VALID_EMAIL_REQUIRED: 'errors.emailRequired',
  ADMIN_REQUIRED: 'errors.adminRequired',
  CANNOT_DELETE_SELF: 'errors.cannotDeleteSelf',
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
  INVALID_PASSWORD_REQUEST_ID: 'errors.passwordRequestNotFound',
  INVALID_STATUS_FILTER: 'errors.invalidStatusFilter',
  INVALID_SUBMISSION_ID: 'errors.invalidSubmissionId',
  INVALID_SUBMISSION_STATUS: 'errors.submissionNotPending',
  INVALID_USER_ID: 'errors.userNotFound',
  INVALID_USERNAME: 'errors.invalidUsername',
  IMAGE_TOO_LARGE: 'errors.imageTooLarge',
  INVALID_COORDINATES: 'errors.invalidCoordinates',
  LINKED_LOCATION_NOT_FOUND: 'errors.linkedLocationNotFound',
  LOCATION_NOT_FOUND: 'errors.locationNotFound',
  NAME_REQUIRED: 'errors.nameRequired',
  NO_EVENT_IMAGE: 'errors.noEventImage',
  NO_IMAGE_FILE: 'errors.imageFileRequired',
  NO_LOCATION_IMAGE: 'errors.noLocationImage',
  NO_SUBMISSION_IMAGE: 'errors.noSubmissionImage',
  PASSWORD_REQUEST_NOT_FOUND: 'errors.passwordRequestNotFound',
  PASSWORD_REQUEST_RATE_LIMIT: 'errors.passwordRequestRateLimit',
  PASSWORD_TOO_SHORT: 'errors.passwordTooShort',
  PENDING_SUBMISSION_NOT_FOUND: 'errors.pendingSubmissionNotFound',
  REGISTRATION_RATE_LIMIT: 'errors.registrationRateLimit',
  SUBMISSION_NOT_FOUND: 'errors.submissionNotFound',
  SUBMISSION_RATE_LIMIT: 'errors.submissionRateLimit',
  TITLE_REQUIRED: 'errors.titleRequired',
  UNAUTHENTICATED: 'errors.authenticationRequired',
  UNSUPPORTED_IMAGE_TYPE: 'errors.unsupportedImageType',
  USER_NOT_FOUND: 'errors.userNotFound',
  USERNAME_REQUIRED: 'errors.usernameRequired',
  USERNAME_TAKEN: 'errors.usernameTaken',
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
