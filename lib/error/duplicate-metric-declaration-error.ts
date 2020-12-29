class DuplicateMetricDeclarationError extends Error {
  message: string;
  options: object;
  name: string = 'DuplicateMetricDeclarationError';

  constructor(message: string, options: {
    [key: string]: any
  } = {}) {
    super(message);

    this.options = options;
  }
}

export = DuplicateMetricDeclarationError;
