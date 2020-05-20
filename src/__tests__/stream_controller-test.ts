import StreamController from "../stream_controller";
import Stream from "../stream";
const flush = () => new Promise(setImmediate);

describe("StreamController", () => {
  let streamController: StreamController<any>;
  beforeEach(() => (streamController = new StreamController()));
  afterEach(() => streamController.close());

  describe(".stream", () => {
    it("returns the stream that it is controlling", () => {
      expect(streamController.stream).toBeDefined();
    });
  });

  describe("broadcast", () => {
    it("returns a broadcast stream", async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const streamController = StreamController.broadcast();
      streamController.stream.listen(listener1);
      streamController.stream.listen(listener2);
      streamController.add("foo");
      await flush();
      expect(listener1).toHaveBeenCalledWith("foo");
      expect(listener2).toHaveBeenCalledWith("foo");
    });
  });

  describe("add", () => {
    it("adds messages to the stream", async () => {
      const listener = jest.fn();
      streamController.stream.listen(listener);
      streamController.add("foo");
      await flush();
      expect(listener).toHaveBeenCalledWith("foo");
    });
  });

  describe("addError", () => {
    it("adds error messages to the stream", async () => {
      const onError = jest.fn();
      streamController.stream.listen(() => {}, { onError });
      streamController.addError("bar");
      await flush();
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe("bar");
    });
  });

  describe("addStream", () => {
    it("consumes another stream and adds it to the current stream", async () => {
      const listener = jest.fn();
      const onError = jest.fn();
      streamController.stream.listen(listener, { onError });
      const toConsume = new Stream<any>();
      const expectedData = ["a", "b", "c"];
      const expectedErrors = ["easy as", "123"];
      expectedData.forEach((d) => toConsume.add(d));
      expectedErrors.forEach((e) => toConsume.addError(e));
      toConsume.close();
      streamController.addStream(toConsume);
      await flush();
      expect(listener).toHaveBeenCalledTimes(3);
      expect(onError).toHaveBeenCalledTimes(2);
      expectedData.forEach((d, index) =>
        expect(listener.mock.calls[index][0]).toBe(d)
      );
      expectedErrors.forEach((e, index) =>
        expect(onError.mock.calls[index][0].message).toBe(e)
      );
    });

    it("resolves the done property after adding the stream", (done) => {
      const listener = jest.fn();
      const toConsume = new Stream<any>();
      const data = ["a", "b", "c"];
      data.forEach((d) => toConsume.add(d));
      toConsume.close();
      streamController.addStream(toConsume);
      streamController.stream.listen(listener);
      expect.assertions(1);
      streamController.done.then(() => {
        expect(listener).toHaveBeenCalledTimes(3);
        done();
      });
    });

    it("only stops consuming the stream if an error occurs and cancelOnError is true", async () => {
      const listener = jest.fn();
      const onError = jest.fn();
      streamController.stream.listen(listener, {
        onError,
        cancelOnError: true,
      });
      const toConsume = new Stream<any>();
      toConsume.add("a");
      toConsume.addError("1");
      toConsume.add("b");
      toConsume.add("c");
      toConsume.addError("2");
      toConsume.addError("3");
      toConsume.close();
      streamController.addStream(toConsume);
      await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("close", () => {
    it("closes the stream", async () => {
      const onDone = jest.fn();
      streamController.stream.listen(() => {}, { onDone });
      streamController.close();
      await flush();
      expect(onDone).toHaveBeenCalled();
    });
  });

  describe("onListen", () => {
    it("calls the onListen when there is a listener on the stream", async () => {
      const onListen = jest.fn();
      streamController.onListen = onListen;
      streamController.stream.listen(() => {});
      await flush();
      expect(onListen).toHaveBeenCalled();
    });
  });

  describe("onPause", () => {
    it("calls the onPause callback when the stream pauses", async () => {
      const onPause = jest.fn();
      streamController.onPause = onPause;
      const sub = streamController.stream.listen(() => {});
      sub.pause();
      await flush();
      expect(onPause).toHaveBeenCalled();
    });
  });

  describe("onResume", () => {
    it("calls the onResume callback when the stream resumes", async () => {
      const onResume = jest.fn();
      streamController.onResume = onResume;
      const sub = streamController.stream.listen(() => {});
      sub.pause();
      sub.resume();
      await flush();
      expect(onResume).toHaveBeenCalled();
    });
  });

  describe("onCancel", () => {
    it("calls the onCancel callback when the subscriber cancels", async () => {
      const onCancel = jest.fn();
      streamController.onCancel = onCancel;
      const sub = streamController.stream.listen(() => {});
      sub.cancel();
      await flush();
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("isPaused", () => {
    it("returns the correct paused status of the stream", async () => {
      const listener = jest.fn();
      const sub = streamController.stream.listen(listener);
      expect(streamController.isPaused).toBe(false);
      sub.pause();
      await flush();
      expect(streamController.isPaused).toBe(true);
    });
  });

  describe("isPaused", () => {
    it("returns the correct closed status of the stream", async () => {
      const listener = jest.fn();
      streamController.stream.listen(listener);
      expect(streamController.isClosed).toBe(false);
      streamController.close();
      await flush();
      expect(streamController.isClosed).toBe(true);
    });
  });

  describe("sink", () => {
    it("returns an object that can add messages to the stream", async () => {
      const listener = jest.fn();
      streamController.stream.listen(listener);
      streamController.sink.add("foo");
      await flush();
      expect(listener).toHaveBeenCalledWith("foo");
    });

    it("returns an object that can add errors to the stream", async () => {
      const onError = jest.fn();
      streamController.stream.listen(() => {}, { onError });
      streamController.sink.addError("oops");
      await flush();
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe("oops");
    });

    it("returns an object that can close the stream", async () => {
      const onDone = jest.fn();
      streamController.stream.listen(() => {}, { onDone });
      streamController.sink.close();
      await flush();
      expect(onDone).toHaveBeenCalledWith();
    });

    it("returns an object that can consume another stream", (done) => {
      const listener = jest.fn();
      const toConsume = new Stream<any>();
      toConsume.add("foo");
      toConsume.close();
      streamController.stream.listen(listener);
      streamController.sink.addStream(toConsume);
      expect.assertions(1);
      streamController.sink.done.then(() => {
        expect(listener).toHaveBeenCalledWith("foo");
        done();
      });
    });
  });
});
