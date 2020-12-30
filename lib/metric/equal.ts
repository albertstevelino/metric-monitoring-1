import { Gauge } from 'prom-client';
import _ from 'lodash';

import Operation from '../interface/operation';
import OperationConfig from '../interface/operation-config';

import VariableTypeError from '../error/variable-type-error';

class Equal implements Operation {
  /**
   * Prometheus metric object.
   */
  promMetric: Gauge<any>;

  /**
   * Use the constant as the value.
   */
  readonly constant?: number;

  /**
   * Use the path to get the value from incoming message.
   */
  readonly path?: string;

  constructor(config: OperationConfig) {
    this.constant = config.constant;
    this.path = config.path;
    this.promMetric = config.promMetric as Gauge<any>;
  }

  /**
   * Set the prometheus metric value when message arrives using value from constant
   * and/or value extracted from message content (if path exists in the message).
   *
   * @param {
   *   [key: string]: any
   * } content
   * @param {
   *   [key: string]: any
   * } label
   */
  modify(content: {
    [key: string]: any
  }, label?: {
    [key: string]: any
  }): void {
    if (!_.isNil(this.constant)) {
      if (_.isEmpty(label)) {
        this.promMetric.set(this.constant);
      } else {
        this.promMetric.set(label, this.constant);
      }
    }

    if (_.isEmpty(this.path)) {
      return;
    }

    const valueFromPath = _.chain(content)
      .get(this.path)
      .defaultTo(undefined)
      .toNumber()
      .value();

    if (_.isNaN(valueFromPath)) {
      throw new VariableTypeError(`Value extracted from ${this.path} is not a number.`, {
        messageContent: content
      });
    } else {
      if (_.isEmpty(label)) {
        this.promMetric.set(valueFromPath);
      } else {
        this.promMetric.set(label, valueFromPath);
      }
    }
  }
}

export = Equal;
