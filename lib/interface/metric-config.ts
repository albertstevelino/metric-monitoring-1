import MetricType from '../enum/metric-type';

interface MetricConfig {
  name: string,
  help: string,
  type: MetricType,
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
  label?: {
    [key: string]: {
      path: string
    }
  }
}

export = MetricConfig;
