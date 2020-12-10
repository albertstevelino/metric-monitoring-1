interface Operation {
  readonly constant?: number;
  readonly path?: string;

  modify(content: {
    [key: string]: any
  }, label?: {
    [key: string]: any
  }): void;
}

export = Operation;
