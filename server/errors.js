export class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR', headers = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function assert(condition, status, message, code) {
  if (!condition) throw new HttpError(status, message, code);
}
