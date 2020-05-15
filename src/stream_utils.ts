import Stream from "./stream";
import { StreamSubscriptionActions } from "./stream_subscription";
import {
  StreamMessageError,
  StreamMessageData,
  StreamMessageType,
  StreamMessageDone,
} from "./types";

/** @ignore utility for handling promises: cancels subscription and (resolve | rejects) the value */
export const cancelAndFulfill = function (
  v: any,
  sub: StreamSubscriptionActions,
  fulfill: (v: any) => void
) {
  sub.cancel();
  fulfill(v);
};

/** @ignore utility for running a function on the next tick **/
/* istanbul ignore next*/
export const nextTick = function (fn: () => any) {
  const nextTick = global?.process?.nextTick || Promise.resolve().then;
  nextTick(fn);
};

/** @ignore utility for creating a *data* StreamMessage **/
export const createDataMessage = function <T>(data: T): StreamMessageData<T> {
  return { type: StreamMessageType.Data, data };
};

/** @ignore utility for creating an *error* StreamMessage **/
export const createErrorMessage = function (
  m: string | Error
): StreamMessageError {
  let err;
  if (typeof m === "string") {
    err = new Error(m);
  } else {
    err = m;
  }
  return { type: StreamMessageType.Error, data: err };
};

/** @ignore utility for creating a *done* StreamMessage **/
export const createDoneMessage = function (): StreamMessageDone {
  return { type: StreamMessageType.Done };
};
