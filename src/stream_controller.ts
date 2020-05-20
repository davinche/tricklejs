import Stream from "./stream";
import { StreamCallback, StreamInterface } from "./types";

interface constructorParams {
  broadcast: boolean;
  onListen?: StreamCallback;
  onPause?: StreamCallback;
  onResume?: StreamCallback;
  onCancel?: StreamCallback;
}

// to mirror the dart stream interface, we want to get rid of the extra
// methods created to add and listen to events on the stream directly.
/** @ignore */
const _validProp = (prop: string) => {
  const blacklist = new Set([
    "addEventListener",
    "removeEventListener",
    "add",
    "addError",
    "pause",
    "resume",
    "cancel",
    "close",
    "isPaused",
    "isClosed",
  ]);
  return !blacklist.has(prop) && prop[0] !== "_";
};

/** @ignore */
const createStreamProxy = <T>(stream: any): StreamInterface<T> => {
  const target: any = {};
  Object.getOwnPropertyNames(Stream.prototype).forEach((prop) => {
    if (!_validProp(prop)) return;
    if (typeof stream[prop] === "function") {
      target[prop] = stream[prop].bind(stream);
    } else {
      Object.defineProperty(target, prop, {
        get: () => stream[prop],
        configurable: false,
        enumerable: true,
      });
    }
  });
  return target as StreamInterface<T>;
};

export default class StreamController<T> {
  private _srcStream: Stream<T>;
  private _dstStream: Stream<T>;
  private _sink: _streamSink<T>;
  private _streamProxy: StreamInterface<T>;
  private _done: Promise<void> = Promise.resolve();

  onListen: StreamCallback | undefined;
  onPause: StreamCallback | undefined;
  onResume: StreamCallback | undefined;
  onCancel: StreamCallback | undefined;

  private _onListen = () => {
    if (this.onListen) {
      this.onListen();
    }
  };
  private _onPause = () => {
    if (this.onPause) {
      this.onPause();
    }
  };
  private _onResume = () => {
    if (this.onResume) {
      this.onResume();
    }
  };

  private _onCancel = () => {
    if (this.onCancel) {
      this.onCancel();
    }
  };

  /**
   * StreamController Constructor
   *
   * Controller that allows sending data, error and done events on its stream.
   * This class is used to control and expose a stream that other code can listen to.
   *
   * @param params listeners: onListen, onPause, onResume, onCancel
   * @template T the type of data to be passed on the stream
   */
  constructor(params: constructorParams = { broadcast: false }) {
    this._srcStream = new Stream<T>();
    this._sink = new _streamSink(this);
    if (params.broadcast) {
      this._dstStream = this._srcStream.asBroadcastStream() as Stream<T>;
    } else {
      this._dstStream = this._srcStream;
    }
    this._streamProxy = createStreamProxy(this._dstStream);
    this.onListen = params.onListen;
    this.onPause = params.onPause;
    this.onResume = params.onResume;
    this.onCancel = params.onCancel;
    this._dstStream.addEventListener("onListen", this._onListen);
    this._dstStream.addEventListener("onPause", this._onPause);
    this._dstStream.addEventListener("onResume", this._onResume);
    this._dstStream.addEventListener("onCancel", this._onCancel);
  }

  add(data: T) {
    this._srcStream.add(data);
  }

  addError(error: string | Error) {
    this._srcStream.addError(error);
  }

  addStream(
    stream: StreamInterface<T>,
    options = { cancelOnError: false }
  ): Promise<void> {
    const p = new Promise<void>((resolve) => {
      stream.listen(this.add.bind(this), {
        onDone: resolve,
        onError: (e) => {
          this.addError(e);
          if (options.cancelOnError) resolve();
        },
        cancelOnError: options.cancelOnError,
      });
    });
    this._done = p;
    return p;
  }

  close() {
    this._srcStream.close();
  }

  get stream(): StreamInterface<T> {
    return this._streamProxy;
  }

  get sink() {
    return this._sink;
  }

  get isPaused(): boolean {
    return this._srcStream.isPaused;
  }

  get isClosed(): boolean {
    return this._srcStream.isClosed;
  }

  get done(): Promise<void> {
    return this._done;
  }

  static broadcast<T>(): StreamController<T> {
    return new StreamController({ broadcast: true });
  }
}

/**
 * Object that only contains add, addError and close methods
 * for a given stream.
 */
/** @ignore */
class _streamSink<T> {
  constructor(private _streamController: StreamController<T>) {}
  add(data: T) {
    this._streamController.add(data);
  }

  addError(error: string | Error) {
    this._streamController.addError(error);
  }

  addStream(
    stream: StreamInterface<T>,
    options = { cancelOnError: false }
  ): Promise<void> {
    return this._streamController.addStream(stream, options);
  }

  close() {
    this._streamController.close();
  }

  get done() {
    return this._streamController.done;
  }
}
