const _ = require('lodash');
const Bluebird = require('bluebird');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const multer = require('multer');
const { register } = require('prom-client');
const client = require('prom-client');
const { Observable } = require('rxjs');

const queuePoller = require('./queue-poller');

const app = express();
const http = require('http').Server(app);

const counter1 = new client.Counter({
  name: 'metric1',
  help: 'metric1_help'
});

const counter2 = new client.Counter({
  name: 'metric2',
  help: 'metric2_help',
  labelNames: ['product', 'partner']
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);

  return res.send(await register.metrics());
});

(async () => {
  const o1 = require('./observer/aws1');
  const queue = require('@cermati/cermati-utils/queue');

  const queueClient = queue.createClient({
    queueUrl: `https://sqs.ap-southeast-1.amazonaws.com/341994046373/${o1.subscribe}`,
    accessKey: 'key',
    accessKeyId: 'key',
    region: 'ap-southeast-1',
    secretKey: 'secret',
    secretAccessKey: 'secret'
  });

  queuePoller.poll({
    pollOptions: {
      maxNumberOfMessages: 1,
    },
    queueClient,
    processMessage: (message) => {
      const obv = new Observable(subscriber => {
        subscriber.next(JSON.parse(message.Body));

        return queueClient.delete(message);
      });

      obv.subscribe(message => {
        counter1.inc(message.amount);
      });

      obv.subscribe(message => {
        counter2.inc({ product: message.product, partner: message.partner });
      });
    },
    delayer: {
      delay: () => {
        return Bluebird.delay(5000);
      },
      reset: _.noop,
      nextDelay: _.constant(5000)
    }
  });
})();

http.listen(8686, function () {
  console.info('listening on *:' + 8686);
});

module.exports = app;

