class UnsupportedQueueServiceError extends TypeError {
  message: string;
  options: object;
  name: string = 'UnsupportedQueueServiceError';

  constructor(message: string, options: {
    [key: string]: any
  } = {}) {
    super(message);

    this.options = options;
  }
}

export = UnsupportedQueueServiceError;
