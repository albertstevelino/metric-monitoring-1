import MetricType from '../enum/metric-type';

interface MetricCommonConfig {
  name: string,
  help: string,
  type: MetricType,
  labels?: Array<string>
}

export = MetricCommonConfig;
