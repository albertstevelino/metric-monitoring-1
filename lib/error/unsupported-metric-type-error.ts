class UnsupportedMetricTypeError extends TypeError {
  message: string;
  options: object;
  name: string = 'UnsupportedMetricTypeError';

  constructor(message: string, options: object = {}) {
    super(message);

    this.options = options;
  }
}

export = UnsupportedMetricTypeError;
