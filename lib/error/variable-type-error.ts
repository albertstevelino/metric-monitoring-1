class VariableTypeError extends TypeError {
  message: string;
  options: object;
  name: string = 'VariableTypeError';

  constructor(message: string, options: {
    [key: string]: any
  } = {}) {
    super(message);

    this.options = options;
  }
}

export = VariableTypeError;
