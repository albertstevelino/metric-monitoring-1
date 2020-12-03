import MetricConfig from './metric-config';
import PollConfig from './poll-config';
import Logger = require('../common/logger');

interface AWSQueueConfig {
  queuePrefixUrl: string;
  topicName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  sessionToken?: string;
  metricConfigs: Array<MetricConfig>;
  pollConfig: PollConfig;
  logger: Logger;
  additionalConfig?: {
    [key: string]: any
  }
}

export = AWSQueueConfig;
