import StreamSubscription from "./stream_subscription";
import StreamController from "./stream_controller";
import { StreamSubscriptionActions } from "./stream_subscription";

import {
  StreamMessageType,
  StreamMessage,
  StreamListener,
  StreamListenOptions,
  StreamCallback,
  StreamInterface,
} from "./types";

import {
  createDataMessage,
  createErrorMessage,
  cancelAndFulfill,
  nextTick,
  createDoneMessage,
} from "./stream_utils";

/**
 * Error to be thrown when adding to a closed stream
 */
/** @ignore */
const ErrorForAdd = new Error("cannot add to closed stream");

/**
 * Error to be thrown when adding errors to a closed stream
 */
/** @ignore */
const ErrorForAddError = new Error("cannot add error to closed stream");

/**
 * Error to be thrown when there are multiple listeners to a non-broadcast stream
 */
/** @ignore */
const ErrorForListen = new Error(
  "cannot have more than one listener on the stream"
);

/** @ignore */
type StreamEventsMap = {
  [key: string]: Array<StreamCallback>;
};

/**
 * Stream
 * @template T - the type for the data in the stream
 */
export default class Stream<T> implements StreamInterface<T> {
  private _subscription: StreamSubscription<T> | null = null;
  /** The buffer containing the stream messages */
  private _buffer: Array<StreamMessage<T>> = [];
  /** internal flag representing the paused state of the stream */
  private _isPaused: boolean = false;
  /** internal flag representing the closed state of the stream */
  protected _isClosed: boolean = false;
  protected _eventCallbacks: StreamEventsMap = {};

  /**
   * Derive a stream from a promise.
   *
   * @param promise - The promise to convert to a stream
   * @returns Stream - The stream
   * @template T - the type of the data resolved by the promise
   */
  static fromPromise<T>(promise: Promise<T>): StreamInterface<T> {
    const streamController = new StreamController<T>();
    promise
      .then((value) => {
        streamController.add(value);
        streamController.close();
      })
      .catch((e) => {
        streamController.addError(e);
        streamController.close();
      });
    return streamController.stream;
  }

  /**
   * Derives a stream from promises
   *
   * Resolved values are data on the stream. Rejected values are errors on the stream.
   * Stream is closed after all promises have been resolved.
   * @param promises
   * @template T the type of data resolved by the promises
   */
  static fromPromises<T>(promises: Iterable<Promise<T>>): StreamInterface<T> {
    const streamController = new StreamController<T>();
    let count = 0;
    const onData = (data: T) => {
      if (!streamController.isClosed) {
        streamController.add(data);
        if (--count === 0) streamController.close();
      }
    };

    const onError = (error: Error) => {
      if (!streamController.isClosed) {
        streamController.addError(error);
        if (--count === 0) streamController.close();
      }
    };

    for (let p of promises) {
      count++;
      p.then(onData, onError);
    }
    return streamController.stream;
  }

  /**
   * Derives a new stream from an existing stream.
   *
   * @param stream
   * @returns stream
   * @template T the type of the data in the stream
   */
  static fromStream<T>(stream: Stream<T>): StreamInterface<T> {
    return new _filteringStream(stream);
  }

  /**
   * _emit - emit messages to listeners
   */
  /** @ignore */
  private _emit() {
    if (this.isPaused || !this._subscription) return;
    nextTick(() => {
      this._buffer.forEach((message) => {
        if (this._subscription) {
          this._subscription.messageHandler(message);
        }
      });
      this._buffer = [];
      if (this._isClosed && this._subscription) {
        this.cancel(this._subscription);
      }
    });
  }

  /**
   * Fire callbacks for event listeners
   *
   * @param name - the event name
   */
  protected _callEventListeners(name: string) {
    nextTick(() => {
      if (this._eventCallbacks[name] && this._eventCallbacks[name].length) {
        this._eventCallbacks[name].forEach((c) => c());
      }
    });
  }

  /**
   * Cancel a StreamSubscription
   *
   * This is called when StreamSubscription.cancel() is called.
   */
  cancel(_: StreamSubscription<T>) {
    this._subscription = null;
    this._callEventListeners("onCancel");
  }

  /**
   * Subscribes a listener and callbacks to the stream.
   *
   * Override to alter the behavior on how listeners are managed.
   * @param onData - the listener
   * @param callbacks - the optional error and ondone callbacks
   */
  listen(
    onData: StreamListener<T>,
    callbacks: StreamListenOptions = {}
  ): StreamSubscriptionActions {
    if (this._subscription) {
      throw ErrorForListen;
    }
    this._subscription = new StreamSubscription(this, onData, callbacks);
    this._callEventListeners("onListen");
    this._emit();
    return this._subscription;
  }

  /**
   * Add messages to the stream.
   *
   * Override to alter how data is processed
   * @param data - the data to add
   */
  add(data: T) {
    if (this.isClosed) throw ErrorForAdd;
    this._buffer.push(createDataMessage(data));
    this._emit();
  }

  /**
   * Add errors to the stream.
   *
   * Override to alter how errors are processed
   * @param message - the error or error message
   */
  addError(message: string | Error) {
    if (this.isClosed) throw ErrorForAddError;
    this._buffer.push(createErrorMessage(message));
    this._emit();
  }

  /**
   * Pause the stream.
   *
   * When a stream is paused, listeners are no longer notified for incoming messages.
   * Unless the stream is a broadcast stream, messages are buffered until the stream is resumed.
   */
  pause() {
    if (!this._isPaused) {
      this._isPaused = true;
      this._callEventListeners("onPause");
    }
  }

  /**
   * Resume the stream.
   *
   * Unless the stream is a broadcast stream, buffered messages will be
   * dispatched to listeners when the stream resumes.
   */
  resume() {
    if (this._isPaused) {
      this._isPaused = false;
      this._callEventListeners("onResume");
      this._emit();
    }
  }

  /**
   * Close the stream.
   *
   * When a stream is closed, add messages/errors to the stream are then prohibbited.
   */
  close() {
    this._isClosed = true;
    this._buffer.push(createDoneMessage());
    this._emit();
  }

  /**
   * Add an event listener to the stream.
   *
   * This is used to be notified for events such as:
   * onListen, onPause, onResume, onCancel.
   *
   * @param name - the name of the event
   * @param callback
   */
  addEventListener(name: string, callback: StreamCallback) {
    if (!this._eventCallbacks[name]) {
      this._eventCallbacks[name] = [];
    }
    this._eventCallbacks[name].push(callback);
  }

  /**
   * Remove an event listener from the stream.
   *
   * @param name - the name of the event
   * @param callback
   */
  removeEventListener(name: string, callback: StreamCallback) {
    if (!this._eventCallbacks[name]) return;
    this._eventCallbacks[name] = this._eventCallbacks[name].filter(
      (c) => c !== callback
    );
  }

  /**
   * Whether the stream is a broadcast stream
   */
  get isBroadcast() {
    return false;
  }

  /**
   * The **closed** state of the stream.
   *
   * @return boolean
   */
  get isClosed() {
    return this._isClosed;
  }

  /**
   * The **paused** state of the stream.
   *
   * @returns boolean
   */
  get isPaused() {
    return this._isPaused;
  }

  /**
   * asBroadcastStream
   *
   * Creates a multilistener enabled stream that receives messages from the current stream.
   * The broadcast stream subscribes to the current stream when it receives its first listener.
   */
  asBroadcastStream(): StreamInterface<T> {
    return new _broadcastStream(this);
  }

  /**
   * Derives new stream that emits mapped values.
   *
   * @param transform - the function that maps data of type T => type U
   * @template T original data type
   * @template U new data type
   */
  map(transform: (data: T) => any): StreamInterface<T> {
    return new _mapStream<T, any>(this, transform);
  }

  /**
   * Derives new stream that consumes only the first *n* messages of the current stream.
   *
   * @param n - the number of messages to consume
   */
  take(n: number): StreamInterface<T> {
    return new _takeStream(this, n);
  }

  /**
   * Dervices a new stream that continues to receive messages from the current stream
   * as long as the `condition` function returns true.
   *
   * @param condition - function that returns true to continue taking
   */
  takeWhile(condition: (data: T) => boolean): StreamInterface<T> {
    return new _takeWhileStream(this, condition);
  }

  /**
   * Derives new stream that skips the first *n* messages of the current stream.
   *
   * @param n - the number of messages to skip
   */
  skip(n: number): StreamInterface<T> {
    return new _skipStream(this, n);
  }

  /**
   * Derives new stream that continues to skip elements in the parent stream
   * until the `condition` function returns false.
   *
   * @param condition
   */
  skipWhile(condition: (data: T) => boolean): StreamInterface<T> {
    return new _skipWhileStream(this, condition);
  }

  /**
   * Derives new stream that only receives messages from the parent stream if
   * the message matches the condition.
   *
   * @param condition
   */
  where(condition: (data: T) => boolean): StreamInterface<T> {
    return new _whereStream(this, condition);
  }

  /**
   * Checks if every message in the stream satisfies a certain condition
   *
   * @param condition
   * @returns Promise - Resolved if every message satifies the condtion, Rejects otherwise
   */
  every(condition: (data: T) => boolean): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const sub = this.listen(
        (data) => {
          try {
            if (condition(data)) return;
          } catch (_) {}
          cancelAndFulfill(false, sub, reject);
        },
        {
          onError: (e) => cancelAndFulfill(e, sub, reject),
          onDone: () => resolve(true),
        }
      );
    });
  }

  /**
   * first - gets the first element in the stream
   *
   * Resolves the first element on the stream.
   * Rejects if there is an error before the first element is found.
   * Rejects if the stream is empty.
   *
   * @returns Promise
   */
  first(): Promise<T> {
    return new Promise((resolve, reject) => {
      const sub = this.listen(
        (data) => {
          cancelAndFulfill(data, sub, resolve);
        },
        {
          onError: (e) => cancelAndFulfill(e, sub, reject),
          onDone: () => reject(new Error()),
        }
      );
    });
  }

  /**
   * firstWhere - gets the first element on the stream that matches a condition
   *
   * Resolves the first element that meets the condition.
   * Rejects if there is an error before the first element is found.
   * Rejects if the stream is empty.
   *
   * @param condition
   */
  firstWhere(condition: (data: T) => boolean): Promise<T> {
    return new Promise((resolve, reject) => {
      const sub = this.listen(
        (data: T) => {
          try {
            if (condition(data)) return cancelAndFulfill(data, sub, resolve);
          } catch (e) {
            cancelAndFulfill(e, sub, reject);
          }
        },
        {
          onError: (e) => cancelAndFulfill(e, sub, reject),
          onDone: () => cancelAndFulfill(null, sub, reject),
        }
      );
    });
  }

  /**
   * forEach - calls the callback for each element in the stream
   *
   * @param listener
   * @returns Promise - Resolved when the stream has ended, Rejected on error.
   */
  forEach(listener: StreamListener<T>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sub = this.listen(
        (data) => {
          try {
            listener(data);
          } catch (e) {
            cancelAndFulfill(e, sub, reject);
          }
        },
        {
          onDone: resolve,
          onError: (e) => cancelAndFulfill(e, sub, reject),
        }
      );
    });
  }

  /**
   * Calls a reducer function and returns value from the final call.
   *
   * @param reducer - fn that returns the new value by taking previous and current messages
   * @param initialValue - the initial value
   */
  reduce(
    reducer: (prev: any, next: T) => any,
    initialValue?: any
  ): Promise<any> {
    let seenFirst = false;
    if (initialValue !== undefined) {
      seenFirst = true;
    }

    return new Promise((resolve, reject) => {
      const sub = this.listen(
        (item) => {
          if (!seenFirst) {
            initialValue = item;
            seenFirst = true;
            return;
          }
          try {
            initialValue = reducer(initialValue, item);
          } catch (e) {
            cancelAndFulfill(e, sub, reject);
          }
        },
        {
          onDone: () => resolve(initialValue),
          onError: (e) => cancelAndFulfill(e, sub, reject),
        }
      );
    });
  }

  /**
   * Takes the elements of a stream and outputs it into an Array.
   *
   * Note: if the stream outputs an error, the promise rejects with the error
   * from the stream.
   *
   * @returns Promise
   */
  toArray(): Promise<Array<T>> {
    return new Promise<Array<T>>((resolve, reject) => {
      const result: Array<T> = [];
      const sub = this.listen(
        (data: T) => {
          result.push(data);
        },
        {
          onError: (e) => cancelAndFulfill(e, sub, reject),
          onDone: () => resolve(result),
        }
      );
    });
  }

  /**
   * Takes the elements of a stream and outputs it into a Set.
   *
   * Note: if the stream outputs an error, the partial result will be
   * provided in the reject of the promise.
   * @returns Set
   */
  toSet(): Promise<Set<T>> {
    return new Promise<Set<T>>((resolve, reject) => {
      const result: Set<T> = new Set();
      const sub = this.listen(
        (data: T) => {
          result.add(data);
        },
        {
          onError: (e) => cancelAndFulfill(e, sub, reject),
          onDone: () => resolve(result),
        }
      );
    });
  }
}

/** @ignore */
class _broadcastStream<T> extends Stream<T> {
  private _parentSubscription: StreamSubscriptionActions | null = null;
  private _subscribers: Set<StreamSubscription<T>> = new Set();

  constructor(private parent: Stream<T>) {
    super();
  }

  add(data: T) {
    if (this.isClosed) throw ErrorForAdd;
    const message = createDataMessage(data);
    nextTick(() => {
      this._subscribers.forEach((s) => s.messageHandler(message));
    });
  }

  addError(e: string | Error) {
    if (this.isClosed) throw ErrorForAddError;
    const error = createErrorMessage(e);
    nextTick(() => {
      this._subscribers.forEach((s) => s.messageHandler(error));
    });
  }

  cancel(subscription: StreamSubscription<T>) {
    this._subscribers.delete(subscription);
    this._callEventListeners("onCancel");
  }

  pause() {}
  resume() {}
  close() {
    this._isClosed = true;
    this._parentSubscription?.cancel();
    this._parentSubscription = null;
    nextTick(() => {
      this._subscribers.forEach((s) => {
        s.messageHandler({ type: StreamMessageType.Done });
      });
    });
  }

  listen(
    onData: StreamListener<T>,
    callbacks: StreamListenOptions = {}
  ): StreamSubscriptionActions {
    if (!this._parentSubscription) {
      this._parentSubscription = this.parent.listen(this.add.bind(this), {
        onError: this.addError.bind(this),
        onDone: this.close.bind(this),
      });
    }

    const sub = new StreamSubscription(this, onData, callbacks);
    this._subscribers.add(sub);
    this._callEventListeners("onListen");
    if (this.isClosed) this.close();
    return sub;
  }

  get isBroadcast() {
    return true;
  }
}

/** @ignore */
class _filteringStream extends Stream<any> {
  protected _sub: StreamSubscriptionActions | null = null;
  constructor(private parent: Stream<any>) {
    super();
  }

  close() {
    this._sub?.cancel();
    this._sub = null;
    super.close();
  }

  listen(
    onData: StreamListener<any>,
    callbacks: StreamListenOptions = {}
  ): StreamSubscriptionActions {
    if (!this._sub) {
      this._sub = this.parent.listen(this.add.bind(this), {
        onError: this.addError.bind(this),
        onDone: this.close.bind(this),
      });
    }
    return super.listen(onData, callbacks);
  }
}

/** @ignore */
class _mapStream<T, U> extends _filteringStream {
  constructor(parent: Stream<T>, private transform: (data: T) => U) {
    super(parent);
  }

  add(data: T) {
    const newData = this.transform(data);
    super.add(newData);
  }
}

/** @ignore */
class _takeStream<T> extends _filteringStream {
  private _taken: number = 0;

  constructor(parent: Stream<T>, private takeAmount: number) {
    super(parent);
  }

  add(data: T) {
    if (this._taken < this.takeAmount) {
      super.add(data);
      this._taken++;
    }
    if (this._taken >= this.takeAmount) {
      this.close();
    }
  }
}

/** @ignore */
class _takeWhileStream<T> extends _filteringStream {
  constructor(s: Stream<T>, private condition: (data: T) => boolean) {
    super(s);
  }

  add(data: T) {
    try {
      if (this.condition(data)) {
        super.add(data);
        return;
      }
    } catch (_) {}
    this.close();
  }
}

/** @ignore */
class _skipStream<T> extends _filteringStream {
  private _skipped: number = 0;

  constructor(parent: Stream<T>, private skipAmount: number) {
    super(parent);
  }

  add(data: T) {
    if (this._skipped < this.skipAmount) {
      return this._skipped++;
    }
    super.add(data);
  }
}

/** @ignore */
class _skipWhileStream<T> extends _filteringStream {
  private _isSkipping: boolean = true;
  constructor(parent: Stream<T>, private condition: (data: T) => boolean) {
    super(parent);
  }

  add(data: T) {
    try {
      if (this._isSkipping && this.condition(data)) return;
    } catch (_) {}
    this._isSkipping = false;
    super.add(data);
  }
}

/** @ignore */
class _whereStream<T> extends _filteringStream {
  /**
   * whereStream constructor
   * @param parent - the parent stream
   * @param condition - the function that returns true for messages to keep
   */
  constructor(parent: Stream<T>, private condition: (data: T) => boolean) {
    super(parent);
  }

  add(data: T) {
    if (this.condition(data)) {
      super.add(data);
    }
  }
}
