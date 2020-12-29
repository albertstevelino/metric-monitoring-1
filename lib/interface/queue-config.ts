import { Counter, Gauge } from 'prom-client';

import QueueService from '../enum/queue-service';

import MetricConfig from './metric-config';
import PollConfig from './poll-config';
import Logger from '../common/logger';

interface QueueConfig {
  queueService: QueueService;
  metricConfigs: Array<MetricConfig>;
  pollConfig: PollConfig;
  logger: Logger;
  metricByName: {
    [key: string]: Counter<any>|Gauge<any>
  }
}

export = QueueConfig;
