import Stream from "../stream";
import StreamSubscription from "../stream_subscription";

const flush = () => new Promise(setImmediate);
describe("Stream", () => {
  let stream: Stream<any>;
  beforeEach(() => {
    stream = new Stream();
  });

  afterEach(() => stream.close());

  describe("listen", () => {
    it("throws when there are multiple listeners", () => {
      const f = jest.fn();
      const f2 = jest.fn();
      const addListeners = () => {
        stream.listen(f);
        stream.listen(f2);
      };
      expect(addListeners).toThrow();
    });

    it("sends a done message if the stream is closed", async () => {
      const f = jest.fn();
      stream.close();
      stream.listen(() => {}, { onDone: f });
      await flush();
      expect(f).toHaveBeenCalled();
    });

    it("calls the onListen event listener", async () => {
      const onListen = jest.fn();
      stream.addEventListener("onListen", onListen);
      stream.listen(() => {});
      await flush();
      expect(onListen).toHaveBeenCalled();
    });
  });

  describe("add", () => {
    it("emits messages to listeners", async () => {
      const f = jest.fn();
      stream.add("msg");
      stream.listen(f);
      await flush();
      expect(f).toHaveBeenCalled();
    });

    it("buffers messages to be emited", async () => {
      stream.add("foo");
      stream.add("bar");
      const f = jest.fn();
      stream.listen(f);
      await flush();
      expect(f).toHaveBeenCalledTimes(2);
      expect(f.mock.calls[0][0]).toBe("foo");
      expect(f.mock.calls[1][0]).toBe("bar");
    });

    it("throws when the stream is closed", () => {
      stream.close();
      const shouldThrow = () => {
        stream.add("test");
      };
      expect(shouldThrow).toThrow();
    });
  });

  describe("addError", () => {
    it("calls the error handler on error", async () => {
      const errHandler = jest.fn();
      stream.listen(() => {}, { onError: errHandler });
      stream.addError("error alert");
      await flush();
      expect(errHandler).toHaveBeenCalled();
      expect(errHandler.mock.calls[0][0].message).toBe("error alert");
    });

    it("accepts type Error", async () => {
      const errHandler = jest.fn();
      stream.listen(() => {}, { onError: errHandler });
      stream.addError(new Error("whopes"));
      await flush();
      expect(errHandler.mock.calls[0][0].message).toBe("whopes");
    });

    it("throws if the stream is closed", () => {
      stream.close();
      const shouldThrow = () => {
        stream.addError("error");
      };
      expect(shouldThrow).toThrow();
    });
  });

  describe("pause", () => {
    it("calls the onPause event listener if the stream is not paused", async () => {
      const onPause = jest.fn();
      stream.addEventListener("onPause", onPause);
      stream.pause();
      await flush();
      expect(onPause).toHaveBeenCalled();
    });

    it("does not call the onPause event listener if the stream is already paused", async () => {
      stream.pause();
      await flush();

      const onPause = jest.fn();
      stream.addEventListener("onPause", onPause);
      stream.pause();
      await flush();
      expect(onPause).not.toHaveBeenCalled();
    });
  });

  describe("resume", () => {
    it("calls the onResume event listener if the stream is paused", async () => {
      stream.pause();
      await flush();
      const onResume = jest.fn();
      stream.addEventListener("onResume", onResume);
      stream.resume();
      await flush();
      expect(onResume).toHaveBeenCalled();
    });

    it("does not call the onResume event listener if the stream is not paused", async () => {
      const onResume = jest.fn();
      stream.addEventListener("onResume", onResume);
      stream.resume();
      await flush();
      expect(onResume).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("does not call my listener after cancelling", async () => {
      const listener = jest.fn();
      const sub = stream.listen(listener);
      stream.add("foo");
      await flush();
      expect(listener).toHaveBeenCalledWith("foo");
      sub.cancel();
      stream.add("bar");
      await flush();
      expect(listener).not.toHaveBeenCalledWith("bar");
    });

    it("calls the onCancel event listener", async () => {
      const onCancel = jest.fn();
      stream.addEventListener("onCancel", onCancel);
      const sub = stream.listen(() => {});
      sub.cancel();
      await flush();
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("calls the onDone handler on close", async () => {
      const onDone = jest.fn();
      stream.listen(() => {}, { onDone });
      stream.close();
      await flush();
      expect(onDone).toHaveBeenCalled();
    });
  });

  describe("asBroadcastStream", () => {
    describe("broadcast stream", () => {
      let broadcast: Stream<any>;
      beforeEach(() => (broadcast = stream.asBroadcastStream() as Stream<any>));
      afterEach(() => broadcast.close());
      describe("listen", () => {
        it("allows for multiple listeners", () => {
          const listeners = Array.apply(null, Array(2)).map(jest.fn);
          listeners.forEach((l: jest.Mock) => broadcast.listen(l));
          const addListeners = () => {
            listeners.forEach((l: jest.Mock) => broadcast.listen(l));
          };
          expect(addListeners).not.toThrow();
        });

        it("broadcasts messages from the original stream to multiple listeners", async () => {
          const listeners = Array.apply(null, Array(2)).map(jest.fn);
          listeners.forEach((l: jest.Mock) => broadcast.listen(l));
          stream.add("foo");
          await flush();
          listeners.forEach((l: jest.Mock) => expect(l).toHaveBeenCalledWith("foo"));
        });

        it("calls the onListen event listener", async () => {
          const onListen = jest.fn();
          broadcast.addEventListener("onListen", onListen);
          broadcast.listen(() => {});
          await flush();
          expect(onListen).toHaveBeenCalled();
        });

        it("sends the close message if the stream is closed", async () => {
          const onDones = Array.apply(null, Array(2)).map(jest.fn);
          broadcast.close();
          onDones.forEach((onDone: jest.Mock) => broadcast.listen(() => {}, { onDone }));
          await flush();
          onDones.forEach((onDone: jest.Mock) => expect(onDone).toHaveBeenCalled());
        });
      });

      describe("add", () => {
        it("broadcasts messages on its stream to multiple listeners", async () => {
          const listeners = Array.apply(null, Array(2)).map(jest.fn);
          listeners.forEach((l: jest.Mock) => broadcast.listen(l));
          broadcast.add("foo");
          await flush();
          listeners.forEach((l: jest.Mock) => expect(l).toHaveBeenCalledWith("foo"));
        });

        it("does not buffer messages for listeners", async () => {
          const f1 = jest.fn();
          const f2 = jest.fn();
          broadcast.listen(f1);
          broadcast.add("foo");
          await flush();
          broadcast.listen(f2);
          await flush();
          expect(f1).toHaveBeenCalledWith("foo");
          expect(f2).not.toHaveBeenCalledWith("foo");
        });

        it("throw if the stream is closed", () => {
          broadcast.close();
          const shouldThrow = () => {
            broadcast.add("test");
          };
          expect(shouldThrow).toThrow();
        });
      });

      describe("addError", () => {
        it("broadcasts errors from the original stream to multiple error handlers", async () => {
          const onErrors = Array.apply(null, Array(2)).map(jest.fn);
          onErrors.forEach((onError: jest.Mock) => broadcast.listen(() => {}, { onError }));
          stream.addError("foo");
          await flush();
          onErrors.forEach((onError: jest.Mock) => expect(onError.mock.calls[0][0].message).toBe("foo"));
        });

        it("broadcasts errors from the original stream to multiple error handlers", async () => {
          const onErrors = Array.apply(null, Array(2)).map(jest.fn);
          onErrors.forEach((onError: jest.Mock) => broadcast.listen(() => {}, { onError }));
          stream.addError(new Error("foo"));
          await flush();
          onErrors.forEach((onError: jest.Mock) => expect(onError.mock.calls[0][0].message).toBe("foo"));
        });

        it("accepts the Error type and broadcasts the error from its own stream to multiple error handlers", async () => {
          const onErrors = Array.apply(null, Array(2)).map(jest.fn);
          onErrors.forEach((onError: jest.Mock) => broadcast.listen(() => {}, { onError }));
          broadcast.addError(new Error("foo"));
          await flush();
          onErrors.forEach((onError: jest.Mock) => expect(onError.mock.calls[0][0].message).toBe("foo"));
        });

        it("throws if the stream is closed", async () => {
          broadcast.close();
          const shouldThrow = () => {
            broadcast.addError("error");
          };
          expect(shouldThrow).toThrow();
        });

        it("closes when the parent stream is closed", async () => {
          const onDone = jest.fn();
          stream.close();
          broadcast.listen(() => {}, { onDone });
          await flush();
          expect(onDone).toHaveBeenCalled();
        });
      });

      describe("cancel", () => {
        it("cancels the correct subscriptions", async () => {
          const listen1 = jest.fn();
          const listen2 = jest.fn();
          const onDone1 = jest.fn();
          const onDone2 = jest.fn();
          const onError1 = jest.fn();
          const onError2 = jest.fn();
          broadcast.listen(listen1, {
            onDone: onDone1,
            onError: onError1
          });
          const sub = broadcast.listen(listen2, {
            onDone: onDone2,
            onError: onError2
          });
          sub.cancel();
          stream.add("foo");
          stream.addError("foo");
          stream.close();
          await flush();
          expect(listen1).toHaveBeenCalled();
          expect(onError1).toHaveBeenCalled();
          expect(onDone1).toHaveBeenCalled();
          expect(listen2).not.toHaveBeenCalled();
          expect(onDone2).not.toHaveBeenCalled();
          expect(onError2).not.toHaveBeenCalled();
        });

        it("calls the onCancel event listener", async () => {
          const onCancel = jest.fn();
          broadcast.addEventListener("onCancel", onCancel);
          const sub = broadcast.listen(() => {});
          sub.cancel();
          await flush();
          expect(onCancel).toHaveBeenCalled();
        });
      });

      describe("close", () => {
        it("calls the onDone handlers on close", async () => {
          const onDones = Array.apply(null, Array(2)).map(() => jest.fn());
          onDones.forEach((onDone: jest.Mock) => broadcast.listen(() => {}, { onDone }));
          broadcast.close();
          await flush();
          onDones.forEach((onDone: jest.Mock) => expect(onDone).toHaveBeenCalled());
        });

        it("calls cancel on the parent stream", async () => {
          const mockCancel = jest.fn();
          stream.cancel = mockCancel;
          broadcast.listen(() => {});
          await flush();
          expect(mockCancel).not.toHaveBeenCalled();
          broadcast.close();
          await flush();
          expect(mockCancel).toHaveBeenCalled();
        });
      });
    });
  });

  describe("addEventListener", () => {
    it("adds the event listener to the stream and calls them when the event happens", async () => {
      const events = ["onListen", "onPause", "onResume", "onCancel"];
      const listeners = events.reduce((obj: { [key: string]: () => void }, eventName) => {
        obj[eventName] = jest.fn();
        return obj;
      }, {});

      events.forEach(ev => stream.addEventListener(ev, listeners[ev]));
      const sub = stream.listen(() => {});
      sub.pause();
      sub.resume();
      sub.cancel();
      await flush();
      events.forEach(ev => expect(listeners[ev]).toHaveBeenCalled());
    });
  });

  describe("removeEventListener", () => {
    it("removes the event listener from the stream", async () => {
      const events = ["onListen", "onPause", "onResume", "onCancel"];
      const listeners = events.reduce((obj: { [key: string]: () => void }, eventName) => {
        obj[eventName] = jest.fn();
        return obj;
      }, {});

      events.forEach(ev => stream.addEventListener(ev, listeners[ev]));
      events.forEach(ev => stream.removeEventListener(ev, listeners[ev]));
      const sub = stream.listen(() => {});
      sub.pause();
      sub.resume();
      sub.cancel();
      await flush();
      events.forEach(ev => expect(listeners[ev]).not.toHaveBeenCalled());
    });
  });

  describe("map", () => {
    it("produces mapped values from the initial stream", async () => {
      const mapped = stream.map(i => i * i);
      const listener = jest.fn();
      mapped.listen(listener);
      stream.add(2);
      await flush();
      expect(listener).toHaveBeenCalledWith(4);
    });
  });

  describe("take", () => {
    it("closes after taking a set number of elements", async () => {
      const mockParentCancel = jest.fn();
      stream.cancel = mockParentCancel;
      const take = stream.take(5);
      const listener = jest.fn();
      const done = jest.fn();
      take.listen(listener, { onDone: done });
      for (let i = 0; i < 5; i++) {
        stream.add(i);
      }
      await flush();
      expect(listener).toBeCalledTimes(5);
      expect(done).toHaveBeenCalled();
      expect(mockParentCancel).toHaveBeenCalled();
    });
  });

  describe("takeWhile", () => {
    it("continues to take from the parent stream while the condition is true", async () => {
      // take while stream continues to emit odd numbers
      const condition = (i: number) => {
        return i % 2 === 1;
      };

      // should take only 1,3,5,7,9
      const expected = [1, 3, 5, 7, 9];
      const data = expected.concat([10, 11, 12, 13]);
      const stream = new Stream<number>();
      const listener = jest.fn();
      const takeWhile = stream.takeWhile(condition);
      takeWhile.listen(listener);
      data.forEach(n => stream.add(n));
      await flush();
      expect(listener).toHaveBeenCalledTimes(expected.length);
      expected.forEach((num, index) => expect(listener.mock.calls[index][0]).toBe(num));
    });

    it("stops if the condition throws", async () => {
      // take while stream continues to emit odd numbers
      const condition = (i: number) => {
        if (i === 1 || i === 2) return true;
        throw "bummer, not 1 or 2";
      };

      // should take only 1,3,5,7,9
      const expected = [1, 2];
      const data = expected.concat([3, 4, 5]);
      const stream = new Stream<number>();
      const listener = jest.fn();
      const onError = jest.fn();
      const takeWhile = stream.takeWhile(condition);
      takeWhile.listen(listener, { onError });
      data.forEach(n => stream.add(n));
      await flush();
      expect(listener).toHaveBeenCalledTimes(expected.length);
      expected.forEach((num, index) => expect(listener.mock.calls[index][0]).toBe(num));
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("skip", () => {
    it("skips the first set number of elements", async () => {
      const skip = stream.skip(5);
      const listener = jest.fn();
      const done = jest.fn();
      skip.listen(listener, { onDone: done });
      for (let i = 0; i < 10; i++) {
        stream.add(i);
      }
      await flush();
      expect(listener.mock.calls.length).toBe(5);
      for (let i = 0; i < listener.mock.calls.length; i++) {
        expect(listener.mock.calls[i][0]).toBe(i + 5);
      }
    });
  });

  describe("skipWhile", () => {
    it("continues to skip data from the parent stream while the condition is true", async () => {
      // skip while stream continues to emit odd numbers
      const condition = (i: number) => {
        return i % 2 === 1;
      };

      // should skip the first 5 odd numbers
      const data = [1, 3, 5, 7, 9, 10, 11, 12, 13];
      const expected = [10, 11, 12, 13];
      const stream = new Stream<number>();
      const listener = jest.fn();
      const skipWhile = stream.skipWhile(condition);
      skipWhile.listen(listener);
      data.forEach(n => stream.add(n));
      await flush();
      // expect(listener).toHaveBeenCalledTimes(expected.length);
      expected.forEach((num, index) => expect(listener.mock.calls[index][0]).toBe(num));
    });

    it("stops skipping if the condition throws", async () => {
      // skip while stream continues to emit odd numbers
      const condition = (i: number) => {
        if (i === 1 || i === 2) return true;
        throw "not 1 or 2";
      };

      // should skip the first 5 odd numbers
      const data = [1, 2, 3, 4, 5];
      const expected = [4, 5];
      const stream = new Stream<number>();
      const listener = jest.fn();
      const onError = jest.fn();
      const skipWhile = stream.skipWhile(condition);
      skipWhile.listen(listener, { onError });
      data.forEach(n => stream.add(n));
      await flush();
      // expect(listener).toHaveBeenCalledTimes(expected.length);
      expected.forEach((num, index) => expect(listener.mock.calls[index][0]).toBe(num));
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("where", () => {
    it("filters out values", async () => {
      const where = stream.where(n => n === 5);
      const listener = jest.fn();
      where.listen(listener);
      for (let i = 0; i < 10; i++) {
        stream.add(i);
      }
      await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(5);
    });
  });

  describe("every", () => {
    it("resolves if every message on the stream satisfies the condition", async () => {
      const cond = (_: any) => true;
      const resolve = jest.fn();
      const reject = jest.fn();
      stream.add(1);
      stream.add(2);
      stream.close();
      stream.every(cond).then(resolve, reject);
      await flush();
      expect(resolve).toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
    });

    it("rejects if not every message on the stream satisfies the condition", async () => {
      const cond = (data: number) => data % 2 === 0;
      const resolve = jest.fn();
      const reject = jest.fn();
      stream.add(1);
      stream.add(2);
      stream.close();
      stream.every(cond).then(resolve, reject);
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
    });

    it("rejects if there is an error on the stream", async () => {
      const cond = (data: number) => data % 2 === 0;
      const resolve = jest.fn();
      const reject = jest.fn();
      stream.add(2);
      stream.add(4);
      stream.addError("uhoh");
      stream.close();
      stream.every(cond).then(resolve, reject);
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
    });

    it("rejects if the condition throws", async () => {
      const cond = (data: number) => {
        if (data === 1) return true;
        throw "not 1";
      };
      const resolve = jest.fn();
      const reject = jest.fn();
      stream.add(1);
      stream.add(2);
      stream.close();
      stream.every(cond).then(resolve, reject);
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
    });
  });

  describe("first", () => {
    it("resolves the first element on the stream", async () => {
      stream.add(1);
      stream.add(2);
      const result = await stream.first();
      expect(result).toBe(1);
    });

    it("rejects if stream outputs an error before first element", async () => {
      const resolve = jest.fn();
      const reject = jest.fn();
      stream.addError("oops");
      stream.add(1);
      stream.first().then(resolve, reject);
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
      expect(reject.mock.calls[0][0].message).toBe("oops");
    });

    it("rejects if stream is empty", async () => {
      const resolve = jest.fn();
      const reject = jest.fn();
      stream.first().then(resolve, reject);
      stream.close();
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
    });
  });

  describe("firstWhere", () => {
    it("resolves the first element on the stream matching a condition", async () => {
      const cond = (num: number) => num === 5;
      const data = [1, 3, 5, 7, 9];
      data.forEach(d => stream.add(d));
      stream.close();
      const result = await stream.firstWhere(cond);
      expect(result).toBe(5);
    });

    it("rejects if stream outputs an error before first element", async () => {
      const resolve = jest.fn();
      const reject = jest.fn();
      const cond = (num: number) => num > 3;
      stream.add(1);
      stream.addError("oops");
      stream.close();
      stream.firstWhere(cond).then(resolve, reject);
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
      expect(reject.mock.calls[0][0].message).toBe("oops");
    });

    it("rejects if condition throws", async () => {
      const resolve = jest.fn();
      const reject = jest.fn();
      const cond = (num: number) => {
        if (num > 3) {
          return false;
        }
        throw "omg";
      };
      stream.add(1);
      stream.add(2);
      stream.add(10);
      stream.close();
      stream.firstWhere(cond).then(resolve, reject);
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
    });

    it("rejects if stream is empty", async () => {
      const cond = (num: number) => num % 2 === 0;
      const resolve = jest.fn();
      const reject = jest.fn();
      stream.firstWhere(cond).then(resolve, reject);
      stream.close();
      await flush();
      expect(resolve).not.toHaveBeenCalled();
      expect(reject).toHaveBeenCalled();
    });
  });

  describe("forEach", () => {
    it("calls the handler for each element in the stream", async () => {
      const handler = jest.fn();
      for (let i = 0; i < 5; i++) {
        stream.add(i);
      }
      stream.close();
      await stream.forEach(handler);
      expect(handler).toHaveBeenCalledTimes(5);
    });

    it("rejects when forEach handler throws an error", async () => {
      const handler = () => {
        throw new Error("dangit");
      };
      stream.add(1);
      expect.assertions(1);
      try {
        await stream.forEach(handler);
      } catch (e) {
        expect(e.message).toBe("dangit");
      }
    });

    it("rejects when there is an error message on the stream", async () => {
      const handler = jest.fn();
      stream.add(1);
      stream.addError("dangit");
      expect.assertions(1);
      try {
        await stream.forEach(handler);
      } catch (e) {
        expect(e.message).toBe("dangit");
      }
    });
  });

  describe("reduce", () => {
    it("returns the correct final value without explicit starting value", async () => {
      const reducer = (prev: number, curr: number) => prev + curr;
      for (let i = 0; i < 5; i++) {
        stream.add(i);
      }
      stream.close();
      const result = await stream.reduce(reducer);
      expect(result).toBe(10);
    });

    it("returns the final value with explicit starting value", async () => {
      const reducer = (prev: number, curr: number) => prev + curr;
      for (let i = 0; i < 5; i++) {
        stream.add(i);
      }
      stream.close();
      const result = await stream.reduce(reducer, 10);
      expect(result).toBe(20);
    });

    it("rejects when the reducer throws an error", async () => {
      const reducer = () => {
        throw new Error("whopes");
      };
      for (let i = 0; i < 5; i++) {
        stream.add(i);
      }
      stream.close();
      expect.assertions(1);
      await flush();
      try {
        await stream.reduce(reducer, 10);
      } catch (e) {
        expect(e.message).toBe("whopes");
      }
    });

    it("rejects when the stream throws an error", async () => {
      const reducer = () => {
        throw new Error("whopes");
      };
      stream.addError("crap");
      stream.close();
      expect.assertions(1);
      await flush();
      try {
        await stream.reduce(reducer, 10);
      } catch (e) {
        expect(e.message).toBe("crap");
      }
    });
  });

  describe("toArray", () => {
    it("returns an array containing the messages from the stream", async () => {
      const expected = [1, 2, 3];
      expected.forEach(n => stream.add(n));
      stream.close();
      await flush();
      const result = await stream.toArray();
      expect(result.length).toBe(expected.length);
      expected.forEach((n, index) => expect(result[index]).toBe(n));
    });

    it("rejects with the error from the stream on error", async () => {
      stream.add(1);
      stream.addError("error");
      stream.add(3);
      await flush();
      expect.assertions(1);
      try {
        await stream.toArray();
      } catch (e) {
        expect(e.message).toBe("error");
      }
    });
  });

  describe("toSet", () => {
    it("returns a Set containing the messages from the stream", async () => {
      const expected = [1, 2, 3];
      expected.forEach(n => stream.add(n));
      stream.close();
      await flush();
      const result = await stream.toSet();
      expect(result.size).toBe(expected.length);
      expected.forEach(n => expect(result.has(n)).toBe(true));
    });

    it("rejects with the error from the stream on error", async () => {
      stream.add(1);
      stream.addError("error");
      stream.add(3);
      await flush();
      expect.assertions(1);
      try {
        await stream.toSet();
      } catch (e) {
        expect(e.message).toBe("error");
      }
    });
  });

  describe("fromPromise", () => {
    it("calls the listener with the value from the promise", async () => {
      const p = Promise.resolve("foo");
      const stream = Stream.fromPromise(p);
      const listener = jest.fn();
      const onDone = jest.fn();
      const onError = jest.fn();
      stream.listen(listener, { onDone, onError });
      await flush();
      expect(listener).toHaveBeenCalledWith("foo");
      expect(onDone).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("emits an error when the promise rejects", async () => {
      const p = Promise.reject("foo");
      const stream = Stream.fromPromise(p);
      const listener = jest.fn();
      const onError = jest.fn();
      stream.listen(listener, { onError });
      await flush();
      expect(listener).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("fromPromises", () => {
    it("calls listeners with the fulfilled values from all of the promises", async () => {
      const promises = [Promise.resolve("foo"), Promise.reject("bar")];
      const stream = Stream.fromPromises(promises);
      const listener = jest.fn();
      const onError = jest.fn();
      const onDone = jest.fn();
      stream.listen(listener, { onError, onDone });
      await flush();
      expect(listener).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(listener.mock.calls[0][0]).toBe("foo");
      expect(onError.mock.calls[0][0].message).toBe("bar");
      expect(onDone).toHaveBeenCalled();
    });
  });

  describe("fromStream", () => {
    it("calls the listener with values derived from another stream", async () => {
      const derived = Stream.fromStream(stream);
      const listener = jest.fn();
      stream.add("foo");
      derived.listen(listener);
      await flush();
      expect(listener).toHaveBeenCalledWith("foo");
    });
  });
});
