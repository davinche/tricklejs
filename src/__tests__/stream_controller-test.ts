import StreamController from "../stream_controller";
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
  });
});
