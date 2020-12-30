interface MetricConfig {
  name: string,
  valueModifier: {
    increase?: {
      constant?: number
      path?: string
    },
    decrease?: {
      constant?: number,
      path?: string
    },
    set?: {
      constant?: number,
      path?: string
    }
  },
  labelPath?: {
    [key: string]: string
  }
}

export = MetricConfig;
