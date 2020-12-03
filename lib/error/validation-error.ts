class ValidationError extends Error {
  message: string;
  options: object;
  name: string = 'ValidationError';

  constructor(message: string, options: object = {}) {
    super(message);

    this.options = options;
  }
}

export = ValidationError;
