import { Counter, Gauge } from 'prom-client';
import _ from 'lodash';

import Operation from '../interface/operation';
import OperationConfig from '../interface/operation-config';

import VariableTypeError from '../error/variable-type-error';

class Increment implements Operation {
  /**
   * Prometheus metric object.
   */
  promMetric: Counter<any>|Gauge<any>;

  /**
   * Use the constant for the increment value.
   */
  readonly constant?: number;

  /**
   * Use the path to get the increment value from incoming message.
   */
  readonly path?: string;

  constructor(config: OperationConfig) {
    this.constant = config.constant;
    this.path = config.path;
    this.promMetric = config.promMetric;
  }

  /**
   * Increase the prometheus metric value when message arrives using value from constant
   * and/or value extracted from message content (if path exists in the message).
   *
   * @param {object} content
   * @param {object} label
   */
  modify(content: object, label?: object): void {
    if (!_.isNil(this.constant)) {
      if (_.isEmpty(label)) {
        this.promMetric.inc(this.constant);
      } else {
        this.promMetric.inc(label, this.constant);
      }
    }

    if (_.isEmpty(this.path)) {
      return;
    }

    const incrementValueFromPath = _.chain(content)
      .get(this.path)
      .defaultTo(undefined)
      .toNumber()
      .value();

    if (_.isNaN(incrementValueFromPath)) {
      throw new VariableTypeError(`Value extracted from ${this.path} is not a number.`, {
        messageContent: content
      });
    } else {
      if (_.isEmpty(label)) {
        this.promMetric.inc(incrementValueFromPath);
      } else {
        this.promMetric.inc(label, incrementValueFromPath);
      }
    }
  }
}

export = Increment;
