import StreamSubscription from "../stream_subscription";
import Stream from "../stream";
import {
  createDataMessage,
  createErrorMessage,
  createDoneMessage,
} from "../stream_utils";
jest.mock("../stream");

describe("Stream Subscription", () => {
  let stream: Stream<any>;
  beforeEach(() => {
    stream = new Stream();
  });
  afterEach(() => stream.close());

  describe("onData", () => {
    it("calls the underlying onData handler", () => {
      const onData = jest.fn();
      const sub = new StreamSubscription(stream, onData);
      sub.messageHandler(createDataMessage("foo"));
      expect(onData).toHaveBeenCalledWith("foo");
    });
  });

  describe("onError", () => {
    it("calls the underlying onError handler", () => {
      const onError = jest.fn();
      const sub = new StreamSubscription(stream, () => {}, { onError });
      sub.messageHandler(createErrorMessage("foo"));
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe("foo");
    });
  });

  describe("onDone", () => {
    it("calls the underlying onDone handler", () => {
      const onDone = jest.fn();
      const sub = new StreamSubscription(stream, () => {}, { onDone });
      sub.messageHandler(createDoneMessage());
      expect(onDone).toHaveBeenCalled();
    });
  });

  describe("cancelOnError", () => {
    it("cancels the subscription on error", () => {
      const sub = new StreamSubscription(stream, () => {}, {
        cancelOnError: true,
      });
      sub.messageHandler(createErrorMessage("oops"));
      expect(stream.cancel).toHaveBeenCalled();
    });
  });

  describe("pause", () => {
    it("calls the onPause callback", () => {
      const onPause = jest.fn();
      const sub = new StreamSubscription(stream, () => {}, { onPause });
      sub.pause();
      expect(onPause).toHaveBeenCalled();
    });

    // note: this should be refactored out of stream test and into stream_subscription test
    it("does not call the onPause callback if it is already paused", () => {
      const onPause = jest.fn();
      const sub = new StreamSubscription(stream, () => {}, { onPause });
      sub.pause();
      onPause.mockClear();
      sub.pause();
      expect(onPause).not.toHaveBeenCalled();
    });

    // note: this should be refactored out of stream test and into stream_subscription test
    it("has the correct paused status", () => {
      const sub = new StreamSubscription(stream, () => {});
      sub.pause();
      expect(sub.isPaused).toBe(true);
    });

    // note: this should be refactored out of stream test and into stream_subscription test
    it("prevents the listener from being called", () => {
      const fn = jest.fn();
      const sub = new StreamSubscription(stream, fn);
      sub.pause();
      sub.messageHandler(createDataMessage("ok"));
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("resume", () => {
    // note: this should be refactored out of stream test and into stream_subscription test
    it("does not call the onResume callback if it is not paused", () => {
      const onResume = jest.fn();
      const sub = new StreamSubscription(stream, () => {}, { onResume });
      sub.resume();
      expect(onResume).not.toHaveBeenCalled();
    });

    // note: this should be refactored out of stream test and into stream_subscription test
    it("calls the onResume callback if it is paused", () => {
      const onResume = jest.fn();
      const sub = new StreamSubscription(stream, () => {}, { onResume });
      sub.pause();
      sub.resume();
      expect(onResume).toHaveBeenCalled();
    });

    // note: this should be refactored out of stream test and into stream_subscription test
    it("buffers messages when paused and calls the listener with buffered messages on resume", () => {
      const fn = jest.fn();
      const sub = new StreamSubscription(stream, fn);
      sub.messageHandler(createDataMessage("foo"));
      sub.pause();
      sub.messageHandler(createDataMessage("bar"));
      sub.messageHandler(createDataMessage("baz"));
      sub.resume();
      expect(fn).toHaveBeenCalledTimes(3);
      ["foo", "bar", "baz"].forEach((m, i) => {
        expect(fn.mock.calls[i][0]).toBe(m);
      });
    });
  });
});
