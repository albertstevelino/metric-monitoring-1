import MetricConfig from './metric-config';
import PollConfig from './poll-config';
import Logger = require('../common/logger');

interface GooglePubSubConfig {
  topicName: string;
  clientEmail: string;
  privateKey: string;
  projectId: string;
  metricConfigs: Array<MetricConfig>;
  pollConfig: PollConfig;
  logger: Logger;
  subscriptionName?: string;
  additionalConfig?: {
    [key: string]: any
  }
}

export = GooglePubSubConfig;
