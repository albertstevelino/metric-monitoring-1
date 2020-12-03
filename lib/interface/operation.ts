interface Operation {
  readonly constant?: number;
  readonly path?: string;

  modify(content: object, label?: object): void;
}

export = Operation;
