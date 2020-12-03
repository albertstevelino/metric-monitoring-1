import { Counter, Gauge } from 'prom-client';
import _ from 'lodash';
import satpam from 'satpam';

import MetricConfig from '../interface/metric-config';
import Operation from '../interface/operation';

import UnsupportedMetricTypeError from '../error/unsupported-metric-type-error';

import MetricType from '../enum/metric-type';

import Increment from './increment';
import Decrement from './decrement';
import Equal from './equal';
import Logger = require('../common/logger');

import {
  CONSTANT_OR_PATH_VALIDATION_RULE,
  COUNTER_VALUE_MODIFIER_VALIDATION_RULE,
  GAUGE_VALUE_MODIFIER_VALIDATION_RULE,
  METRIC_SPECIFICATION_VALIDATION_RULE
} from '../constant/specification';

class Metric {
  /**
   * Prometheus metric object.
   */
  private readonly promMetric: Counter<any>|Gauge<any>;

  /**
   * Path (value) to extract each label (key).
   */
  private readonly labelToPath: {
    [key: string]: string
  };

  /**
   * Operations that will be done to the prometheus metric
   * for every new message.
   */
  private readonly operations: Array<Operation>;

  /**
   * Logger object to print to console.
   */
  private readonly logger: Logger;

  /**
   * Get prometheus metric instance.
   *
   * @param {MetricConfig} config
   *
   * @return {Counter|Gauge|UnsupportedMetricTypeError}
   */
  private static getPromMetric(config: MetricConfig): Counter<any>|Gauge<any> {
    const labelNames = _.keys(config.label);
    const sanitizedLabelNames = labelNames.length > 0
      ? labelNames
      : undefined;

    if (config.type === MetricType.Counter) {
      return new Counter({
        name: config.name,
        help: config.help,
        labelNames: sanitizedLabelNames
      });
    } else if (config.type === MetricType.Gauge) {
      return new Gauge({
        name: config.name,
        help: config.help,
        labelNames: sanitizedLabelNames
      });
    } else {
      throw new UnsupportedMetricTypeError(`Metric type ${config.type} is not supported.`);
    }
  }

  /**
   * Validate metric config specified in certain file path using satpam object validator.
   *
   * @param {MetricConfig} config
   *
   * @return {object} - validation message
   */
  static validateMetricConfig(config: MetricConfig): object {
    const firstLayerValidation = satpam.validate(METRIC_SPECIFICATION_VALIDATION_RULE, config);

    if (!firstLayerValidation.success) {
      return firstLayerValidation.messages;
    }

    const labelKeys = _.keys(config.label);

    const labelValidationRule = {
      label: _.zipObject(labelKeys, Array(labelKeys.length).fill({
        path: ['required', 'string']
      }))
    };

    const valueModifierFirstValidationRule = Metric.getValueModifierFirstValidationRule(config.type);

    const secondLayerValidationRule = _.merge(labelValidationRule, valueModifierFirstValidationRule);

    const secondLayerValidation = satpam.validate(secondLayerValidationRule, config);

    if (!secondLayerValidation.success) {
      return secondLayerValidation.messages;
    }

    const thirdLayerValidationRule = Metric.getValueModifierSecondValidationRule(config.type, config.valueModifier);

    const thirdLayerValidation = satpam.validate(thirdLayerValidationRule, config);

    return thirdLayerValidation.messages;
  }

  /**
   * Get first layer validation rule for valueModifier field in metric config by metric type.
   *
   * @param {MetricType} type
   *
   * @return {object|UnsupportedMetricTypeError}
   */
  private static getValueModifierFirstValidationRule(type: MetricType): object {
    if (type === MetricType.Counter) {
      return COUNTER_VALUE_MODIFIER_VALIDATION_RULE;
    } else if (type === MetricType.Gauge) {
      return GAUGE_VALUE_MODIFIER_VALIDATION_RULE;
    } else {
      throw new UnsupportedMetricTypeError(`Metric type ${type} is not supported.`);
    }
  }

  /**
   * Get second layer validation rule for valueModifier field in metric config by metric type.
   *
   * @param {MetricType} type
   * @param {object} valueModifier
   *
   * @return {object|UnsupportedMetricTypeError}
   */
  private static getValueModifierSecondValidationRule(type: MetricType, valueModifier: object): object {
    let valueModifierValidationRule;

    if (type === MetricType.Counter) {
      valueModifierValidationRule = COUNTER_VALUE_MODIFIER_VALIDATION_RULE;
    } else if (type === MetricType.Gauge) {
      valueModifierValidationRule = GAUGE_VALUE_MODIFIER_VALIDATION_RULE;
    } else {
      throw new UnsupportedMetricTypeError(`Metric type ${type} is not supported.`);
    }

    const validKeys = _.chain(valueModifier)
      .pick(_.keys(valueModifierValidationRule.valueModifier))
      .keys()
      .value();

    return {
      valueModifier: _.zipObject(validKeys, Array(validKeys.length).fill(CONSTANT_OR_PATH_VALIDATION_RULE))
    };
  }

  constructor(config: MetricConfig & { logger: Logger }) {
    this.promMetric = Metric.getPromMetric(config);

    this.labelToPath = _.mapValues(config.label, _.property('path'));
    this.operations = [];
    this.logger = config.logger;

    if (_.has(config.valueModifier, 'increase')) {
      const operation = new Increment({
        ...config.valueModifier.increase,
        promMetric: this.promMetric
      });

      this.operations.push(operation);
    }

    if (_.has(config.valueModifier, 'decrease') && config.type === MetricType.Gauge) {
      const operation = new Decrement({
        ...config.valueModifier.decrease,
        promMetric: this.promMetric
      });

      this.operations.push(operation);
    }

    if (_.has(config.valueModifier, 'set') && config.type === MetricType.Gauge) {
      const operation = new Equal({
        ...config.valueModifier.set,
        promMetric: this.promMetric
      });

      this.operations.push(operation);
    }
  }

  /**
   * Modify prometheus metric value using each of the operation.
   *
   * @param {object} content - message parsed from queue
   */
  modify(content: object): void {
    const label = _.isEmpty(this.labelToPath)
      ? undefined
      : _.mapValues(this.labelToPath, (path) => {
        return _.get(content, path);
      });

    for (const operation of this.operations) {
      try {
        operation.modify(content, label);
      } catch (error) {
        this.logger.warn(`Error when trying to modify metric. Path: ${operation.path}. Content: ${JSON.stringify(content)}. Error: ${error.message || JSON.stringify(error.stack)}`);
      }
    }
  }
}

export = Metric;
