import { Counter, Gauge } from 'prom-client';

import MetricConfig from './metric-config';
import PollConfig from './poll-config';

import Logger from '../common/logger';

interface AWSQueueConfig {
  queuePrefixUrl: string;
  subscriptionName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  sessionToken?: string;
  metricConfigs: Array<MetricConfig>;
  metricByName: {
    [key: string]: Counter<any>|Gauge<any>
  }
  pollConfig: PollConfig;
  logger: Logger;
  additionalConfig?: {
    [key: string]: any
  }
}

export = AWSQueueConfig;
