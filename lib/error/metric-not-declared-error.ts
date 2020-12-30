class MetricNotDeclaredError extends Error {
  message: string;
  options: object;
  name: string = 'MetricNotDeclaredError';

  constructor(message: string, options: {
    [key: string]: any
  } = {}) {
    super(message);

    this.options = options;
  }
}

export = MetricNotDeclaredError;
