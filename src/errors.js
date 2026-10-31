'use strict';

/** An error that is safe to show to the client: it carries an HTTP status and a public message. */
class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message Message that is safe to return to the browser
   * @param {{retryAfter?: number, allow?: string}} [extra] Extra headers (e.g. Retry-After, Allow)
   */
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.extra = extra;
  }
}

module.exports = { HttpError };
