import {
  StreamListener,
  StreamListenOptions,
  StreamMessage,
  StreamMessageType,
} from "./types";

import Stream from "./stream";

export interface StreamSubscriptionActions {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export default class StreamSubscription<T>
  implements StreamSubscriptionActions {
  private _buffer: Array<StreamMessage<T>> = [];
  private _isPaused: boolean = false;

  constructor(
    private stream: Stream<T>,
    private onData: StreamListener<T>,
    private listenOptions: StreamListenOptions = {}
  ) {}

  private _emit() {
    if (this._isPaused) return;
    this._buffer.forEach((m) => {
      switch (m.type) {
        case StreamMessageType.Data:
          this.onData(m.data);
          break;
        case StreamMessageType.Error:
          if (this.listenOptions.onError) {
            this.listenOptions.onError(m.data);
          }
          if (this.listenOptions.cancelOnError) {
            this.cancel();
          }
          break;
        case StreamMessageType.Done:
          if (this.listenOptions.onDone) {
            this.listenOptions.onDone();
          }
          break;
      }
    });
    this._buffer = [];
  }

  messageHandler(message: StreamMessage<T>) {
    this._buffer.push(message);
    this._emit();
  }

  pause() {
    if (!this._isPaused) {
      this._isPaused = true;
      if (this.listenOptions.onPause) {
        this.listenOptions.onPause();
      }
      this.stream.pause();
    }
  }

  resume() {
    if (this._isPaused) {
      this._isPaused = false;
      if (this.listenOptions.onResume) {
        this.listenOptions.onResume();
      }
      this.stream.resume();
      this._emit();
    }
  }

  cancel() {
    this.stream.cancel(this);
  }

  get isPaused(): boolean {
    return this._isPaused;
  }
}
