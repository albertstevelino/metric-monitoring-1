import _ from 'lodash';

import QueueService from '../enum/queue-service';
import MetricType from '../enum/metric-type';

export const FIRST_LAYER_SPECIFICATION_VALIDATION_RULE = {
  service: ['required', {
    name: 'memberOf',
    params: [_.values(QueueService)]
  }],
  topic: ['required', 'string'],
  subscription: ['string'],
  consumerCount: ['required', 'minValue:0', 'maxValue:50', 'integer'],
  concurrency: ['required', 'minValue:0', 'maxValue:50', 'integer'],
  metrics: ['required', 'array']
};

export const METRIC_SPECIFICATION_VALIDATION_RULE = {
  name: ['required', 'string'],
  help: ['required', 'string'],
  type: ['required', {
    name: 'memberOf',
    params: [_.values(MetricType)]
  }],
  valueModifier: ['required', 'plainObject'],
  label: ['plainObject']
};

export const CREDENTIAL_VALIDATION_RULE = {
  [QueueService.GooglePubSub]: {
    clientEmail: ['required', 'string'],
    privateKey: ['required', 'string'],
    projectId: ['required', 'string'],
    additionalConfig: ['plainObject']
  },
  [QueueService.AWS]: {
    queuePrefixUrl: ['required', 'string'],
    accessKeyId: ['required', 'string'],
    secretAccessKey: ['required', 'string'],
    region: ['string'],
    sessionToken: ['string'],
    additionalConfig: ['plainObject']
  }
};

export const CONSTANT_OR_PATH_VALIDATION_RULE = {
  constant: [{
    fullName: 'requiredIf:$1:$2',
    params: [{
      type: 'or',
      mappings: {
        path: [
          { '$equal': null },
          { '$equal': undefined },
          { '$equal': '' }
        ]
      }
    }]
  }, 'integer', 'minValue:0'],
  path: ['string']
};

export const COUNTER_VALUE_MODIFIER_VALIDATION_RULE = {
  valueModifier: {
    increase: ['required', 'plainObject']
  }
};

export const GAUGE_VALUE_MODIFIER_VALIDATION_RULE = {
  valueModifier: {
    increase: [{
      fullName: 'requiredIf:$1:$2',
      params: [{
        type: 'and',
        mappings: {
          decrease: {
            type: 'or',
            mappings: {
              decrease: [
                { '$equal': null },
                { '$equal': undefined }
              ]
            }
          },
          set: {
            type: 'or',
            mappings: {
              set: [
                { '$equal': null },
                { '$equal': undefined }
              ]
            }
          }
        }
      }]
    }, 'plainObject'],
    decrease: [{
      fullName: 'requiredIf:$1:$2',
      params: [{
        type: 'and',
        mappings: {
          increase: {
            type: 'or',
            mappings: {
              increase: [
                { '$equal': null },
                { '$equal': undefined }
              ]
            }
          },
          set: {
            type: 'or',
            mappings: {
              set: [
                { '$equal': null },
                { '$equal': undefined }
              ]
            }
          }
        }
      }]
    }, 'plainObject'],
    set: [{
      fullName: 'requiredIf:$1:$2',
      params: [{
        type: 'and',
        mappings: {
          increase: {
            type: 'or',
            mappings: {
              increase: [
                { '$equal': null },
                { '$equal': undefined }
              ]
            }
          },
          decrease: {
            type: 'or',
            mappings: {
              decrease: [
                { '$equal': null },
                { '$equal': undefined }
              ]
            }
          }
        }
      }]
    }, 'plainObject']
  }
};
