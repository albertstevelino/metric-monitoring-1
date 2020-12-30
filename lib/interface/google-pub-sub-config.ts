import { Counter, Gauge } from 'prom-client';

import MetricConfig from './metric-config';
import PollConfig from './poll-config';

import Logger from '../common/logger';

interface GooglePubSubConfig {
  clientEmail: string;
  privateKey: string;
  projectId: string;
  metricConfigs: Array<MetricConfig>;
  pollConfig: PollConfig;
  logger: Logger;
  metricByName: {
    [key: string]: Counter<any>|Gauge<any>
  }
  subscriptionName: string;
  additionalConfig?: {
    [key: string]: any
  }
}

export = GooglePubSubConfig;
