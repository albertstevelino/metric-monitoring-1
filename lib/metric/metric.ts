import { Counter, Gauge } from 'prom-client';
import _ from 'lodash';
import satpam from 'satpam';

import MetricConfig from '../interface/metric-config';
import MetricCommonConfig from '../interface/metric-common-config';
import Operation from '../interface/operation';

import UnsupportedMetricTypeError from '../error/unsupported-metric-type-error';
import MetricNotDeclaredError from '../error/metric-not-declared-error';
import DuplicateMetricDeclarationError from '../error/duplicate-metric-declaration-error';

import MetricType from '../enum/metric-type';

import Increment from './increment';
import Decrement from './decrement';
import Equal from './equal';
import Logger from '../common/logger';

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
  readonly promMetric: Counter<any>|Gauge<any>;

  /**
   * Path (value) to extract each label (key).
   */
  readonly labelToPath: {
    [key: string]: string
  };

  /**
   * Operations that will be done to the prometheus metric
   * for every new message.
   */
  readonly operations: Array<Operation>;

  /**
   * Logger object to print to console.
   */
  readonly logger: Logger;

  /**
   * Get prometheus metric instance.
   *
   * @param {MetricConfig} config
   *
   * @return {Counter|Gauge|UnsupportedMetricTypeError}
   */
  static getPromMetric(config: MetricCommonConfig): Counter<any>|Gauge<any> {
    const labelNames = _.defaultTo(config.labels, []);
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
   * Get metric type.
   *
   * @param {Counter<any>|Gauge<any>} metric
   *
   * @return {MetricType|UnsupportedMetricTypeError}
   */
  static getMetricType(metric: Counter<any>|Gauge<any>) {
    if (metric instanceof Counter) {
      return MetricType.Counter;
    } else if (metric instanceof Gauge) {
      return MetricType.Gauge;
    } else {
      throw new UnsupportedMetricTypeError(`Metric type cannot be recognized.`);
    }
  }

  /**
   * Validate metric config specified in certain file path using satpam object validator.
   *
   * @param {MetricConfig} config
   * @param {
   *   [key: string]: Counter<any>|Gauge<any>
   * } metricByName
   * @param {Set<string>} metricNameSet
   *
   * @return {
   *   [key: string]: any
   * } - validation message
   */
  static validateMetricConfig(config: MetricConfig, metricByName: {
   [key: string]: Counter<any>|Gauge<any>
  }, metricNameSet: Set<string>): {
    [key: string]: any
  } {
    const firstLayerValidation = satpam.validate(METRIC_SPECIFICATION_VALIDATION_RULE, config);

    if (!firstLayerValidation.success) {
      return firstLayerValidation.messages;
    }

    if (!metricByName[config.name]) {
      throw new MetricNotDeclaredError(`Metric ${config.name} has not been declared yet.`);
    }

    if (metricNameSet.has(config.name)) {
      throw new DuplicateMetricDeclarationError(`Metric ${config.name} is declared more than once in the same subscriber/consumer.`);
    }

    metricNameSet.add(config.name);

    const labelValidationRule = {
      labelPath: _.chain(metricByName[config.name])
        .get('labelNames')
        .keyBy()
        .mapValues(() => {
          return ['required', 'string'];
        })
        .value()
    };

    const metricType = Metric.getMetricType(metricByName[config.name]);

    const valueModifierFirstValidationRule = Metric.getValueModifierFirstValidationRule(metricType);

    const secondLayerValidationRule = _.merge(labelValidationRule, valueModifierFirstValidationRule);

    const secondLayerValidation = satpam.validate(secondLayerValidationRule, config);

    if (!secondLayerValidation.success) {
      return secondLayerValidation.messages;
    }

    const thirdLayerValidationRule = Metric.getValueModifierSecondValidationRule(metricType, config.valueModifier);

    const thirdLayerValidation = satpam.validate(thirdLayerValidationRule, config);

    return thirdLayerValidation.messages;
  }

  /**
   * Get first layer validation rule for valueModifier field in metric config by metric type.
   *
   * @param {MetricType} type
   *
   * @return {{
   *   [key: string]: any
   * }|UnsupportedMetricTypeError}
   */
  static getValueModifierFirstValidationRule(type: MetricType): {
    [key: string]: any
  } {
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
   * @param {
   *   [key: string]: any
   * } valueModifier
   *
   * @return {{
   *   [key: string]: any
   * }|UnsupportedMetricTypeError}
   */
  static getValueModifierSecondValidationRule(type: MetricType, valueModifier: {
    [key: string]: any
  }): {
    [key: string]: any
  } {
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

  constructor(config: MetricConfig & {
    metricByName: {
      [key: string]: Counter<any>|Gauge<any>
    },
    logger: Logger
  }) {
    this.promMetric = config.metricByName[config.name];

    this.labelToPath = _.pick(config.labelPath, _.get(this.promMetric, 'labelNames'));
    this.operations = [];
    this.logger = config.logger;

    const metricType = Metric.getMetricType(this.promMetric);

    if (_.has(config.valueModifier, 'increase')) {
      const operation = new Increment({
        ...config.valueModifier.increase,
        promMetric: this.promMetric
      });

      this.operations.push(operation);
    }

    if (_.has(config.valueModifier, 'decrease') && metricType === MetricType.Gauge) {
      const operation = new Decrement({
        ...config.valueModifier.decrease,
        promMetric: this.promMetric
      });

      this.operations.push(operation);
    }

    if (_.has(config.valueModifier, 'set') && metricType === MetricType.Gauge) {
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
   * @param {
   *   [key: string]: any
   * } content - message parsed from queue
   */
  modify(content: {
    [key: string]: any
  }): void {
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
