import { Gauge } from 'prom-client';
import _ from 'lodash';

import Operation from '../interface/operation';
import OperationConfig from '../interface/operation-config';

import VariableTypeError = require('../error/variable-type-error');

class Decrement implements Operation {
  /**
   * Prometheus metric object.
   */
  promMetric: Gauge<any>;

  /**
   * Use the constant for the decrement value.
   */
  readonly constant?: number;

  /**
   * Use the path to get the decrement value from incoming message.
   */
  readonly path?: string;

  constructor(config: OperationConfig) {
    this.constant = config.constant;
    this.path = config.path;
    this.promMetric = config.promMetric as Gauge<any>;
  }

  /**
   * Decrease the prometheus metric value when message arrives using value from constant
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
        this.promMetric.dec(this.constant);
      } else {
        this.promMetric.dec(label, this.constant);
      }
    }

    if (_.isEmpty(this.path)) {
      return;
    }

    const decrementValueFromPath = _.chain(content)
      .get(this.path)
      .defaultTo(undefined)
      .toNumber()
      .value();

    if (_.isNaN(decrementValueFromPath)) {
      throw new VariableTypeError(`Value extracted from ${this.path} is not a number.`, {
        messageContent: content
      });
    } else {
      if (_.isEmpty(label)) {
        this.promMetric.dec(decrementValueFromPath);
      } else {
        this.promMetric.dec(label, decrementValueFromPath);
      }
    }
  }
}

export = Decrement;
