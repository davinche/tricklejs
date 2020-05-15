# TrickleJS

![build](https://travis-ci.org/davinche/tricklejs.svg?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/davinche/tricklejs/badge.svg?branch=master)](https://coveralls.io/github/davinche/tricklejs?branch=master)

TrickleJS is a partial implementation of Dart's [StreamController][sc] and [Stream][stream].
The purpose is to provide a library with a similar interface to Dart streams such that one could start
build applications using things like the [BloC][bloc] architecture in JS without diving into the hairy world of [Reactive Extensions][rxjs].

## Installation

`npm install --save tricklejs`

## Usage

Example: Countdown Timer

```javascript
import { StreamController } from "tricklejs";

const getTickerStream = function (numberOfTicks) {
  const sc = new StreamController();
  let counter = 0;
  let timer = null;
  const start = () => {
    if (timer) return;
    timer = setInterval(() => {
      if (counter < numberOfTicks) {
        sc.add(counter);
        counter++;
      } else {
        stop();
        sc.close();
      }
    }, 1000);
  };

  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  sc.onListen = start;
  sc.onResume = start;
  sc.onPause = stop;
  sc.onCancel = stop;
  return sc.stream;
};

const countDown = getTickerStream(5);
console.log("Countdown...");
countDown.listen(
  (n) => {
    console.log(5 - n);
  },
  { onDone: () => console.log("Blastoff!") }
);
```

[sc]: https://api.dart.dev/stable/2.8.2/dart-async/StreamController-class.html
[stream]: https://api.dart.dev/stable/2.8.2/dart-async/Stream-class.html
[bloc]: https://flutter.dev/docs/development/data-and-backend/state-mgmt/options
[rxjs]: https://rxjs-dev.firebaseapp.com/
