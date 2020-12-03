import QueueService = require('../enum/queue-service');

import MetricConfig from './metric-config';
import PollConfig = require('./poll-config');
import Logger = require('../common/logger');

interface QueueConfig {
  queueService: QueueService;
  metricConfigs: Array<MetricConfig>;
  pollConfig: PollConfig;
  logger: Logger;
}

export = QueueConfig;
