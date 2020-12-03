import { Counter, Gauge } from 'prom-client';

interface OperationConfig {
  constant?: number;
  path?: string;
  promMetric: Counter<any>|Gauge<any>;
}

export = OperationConfig;
