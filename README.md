# Metric Monitoring
### Introduction
The purpose of this package is to monitor a number of parameters, for example: number of users created in each second, number of applications created in each second, and so on. The metrics produced can help to detect problem faster. For instance, when the number of users created or applications created goes down drastically. Stakeholders can also refer to these metrics to support future decision. 

### How Does It Work?
The project is built on top of [`prom-client`](https://www.npmjs.com/package/prom-client). The client publishes the events and the subscribers/consumers will consume the events to increment/decrement/set a number of metrics in prometheus client that have been defined before. The next question is how to define the metrics? The client passes file configurations that contain the detailed information, for example: what service will be used to implement the consumers/subscribers, the number of consumers/subscribers, and so on.

Below is the detail of the file configuration content.
| key | value |
| ------ | ------ |
| `service` | The type of service that you want to use. Right now, this package supports `AWS` and `GOOGLE_PUB_SUB`.|
| `subscription` | The name of the subscription/queue. If you use `AWS`, you should pass the name of the queue. If you use `GOOGLE_PUB_SUB`, you should pass the name of the subscription.  |
| `consumerCount` | The number of subscribers/consumers that will be spawned. Maximum value is `50`. |
| `concurrency` | The number of messages that will be consumed concurrently in each subscriber/consumer. |
| `metrics` | Array of metric configurations which define metrics that will be created in prometheus client. |

Below is the detail of each metric configuration. You can refer to [`prom-client`](https://www.npmjs.com/package/prom-client) for further explanation of each term used here.
| key | value |
| ------ | ------ |
| `name` | Field that will be used in metric initialization.  |
| `help` | Field that will be used in metric initialization.  |
| `type` | The type of metric that will be used. Right now, this package supports `GAUGE` and `COUNTER`. |
| `valueModifier` | There are three types of keys allowed: `increase`, `decrease`, and `set`. In `GAUGE` metric, you can specify all of them. However, in `COUNTER` metric you can only specify `increase`. Each of the key must contain either `constant` (integer value) or `path` (string value). If `increase` field contains `constant = 1`, it means that for every message consumed, it will increase the metric with `1`. If `increase` field contains `path = productType.count`, it means that for every message consumed, it will increase the metric with value inside `productType.count` path which will be read from the message content. |
| `label` | Label of the metrics. Each label can contain `path` key to specify path to read the value of the label from the message content. |

Below is the example of a file configuration that uses `GOOGLE_PUB_SUB` service.

```
{
  "service": "GOOGLE_PUB_SUB",
  "subscription": "dev_playroom~~event.received.test",
  "consumerCount": 5,
  "concurrency": 4,
  "metrics": [
    {
      "name": "app_created_count",
      "help": "app_created_count_help",
      "type": "GAUGE",
      "valueModifier": {
        "increase": {
          "path": "numberOfApplicationCreated"
        }
      },
      "label": {
        "productType": {
          "path": "applicationProductType"
        },
        "partner": {
          "path": "applicationPartner"
        }
      }
    }
  ]
}
```

When the subscriber/consumer receives a new message:

```
{
   "applicationProductType": "CASH_LOAN",
   "applicationPartner": "INDODANA",
   "numberOfApplicationCreated": 5
}
```

The orchestrator will increase metric `app_created_count` with labels: `productType = CASH_LOAN` and `partner = INDODANA`, with value equal to `5`.

### Implementation
To use this package you need to instantiate a new orchestrator and pass the required credentials to the constructor depends on the service you use inside the file configurations. Besides, you can also pass the `logger` object that you want to use to log the error or information to the screen, by default the package uses `console`. You can pass more than one file configurations to `orchestrator.register` by using `filePaths` or `directoryPaths`. If you specify the `directoryPaths`, the program will read the file configurations recursively from each directory.

```
require('app-module-path').addPath(process.cwd());
require('dotenv').config({ path: process.env.DOTENV_PATH });

const logger = console;

const Orchestrator = require('metric-monitoring');

(async () => {
  const orchestrator = new Orchestrator({
    GOOGLE_PUB_SUB: {
      clientEmail: process.env.CLIENT_EMAIL,
      privateKey: process.env.PRIVATE_KEY,
      projectId: process.env.PROJECT_ID
    },
    AWS: {
      queuePrefixUrl: process.env.QUEUE_PREFIX_URL,
      accessKeyId: process.env.AMAZON_ACCESS_KEY_ID,
      secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
      region: process.env.AMAZON_SQS_REGION
    }
  }, logger);

  await orchestrator.register({
    directoryPaths: [
      'resource/'
    ]
  });

  orchestrator.startQueues();

  orchestrator.start(8686, '/metrics');
})();
```

This code example will serve the resulting metrics at `http://localhost:8686/metrics`. You can start publishing messages now and see the impact on the metrics.
