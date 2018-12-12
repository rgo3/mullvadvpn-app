// @flow

export type OnFrameFn = (frame: number) => void;
export type OnFinishFn = (void) => void;
export type KeyframeAnimationOptions = {
  startFrame?: number,
  endFrame?: number,
  beginFromCurrentState?: boolean,
  advanceTo?: 'end',
};
export type KeyframeAnimationRange = [number, number];

export default class KeyframeAnimation {
  _speed: number = 200; // ms
  _reverse: boolean = false;

  _onFrame: ?OnFrameFn;
  _onFinish: ?OnFinishFn;

  _frameRange: KeyframeAnimationRange;
  _numFrames: number;
  _currentFrame: number = 0;

  _isRunning: boolean = false;
  _isFinished: boolean = false;
  _isFirstRun: boolean = true;

  _timeout = null;

  set onFrame(newValue: ?OnFrameFn) {
    this._onFrame = newValue;
  }
  get onFrame(): ?OnFrameFn {
    return this._onFrame;
  }

  // called when animation finished
  set onFinish(newValue: ?OnFinishFn) {
    this._onFinish = newValue;
  }
  get onFinish(): ?OnFinishFn {
    return this._onFinish;
  }

  // pace per frame in ms
  set speed(newValue: number) {
    this._speed = parseInt(newValue);
  }
  get speed(): number {
    return this._speed;
  }

  set reverse(newValue: boolean) {
    this._reverse = newValue;
  }
  get reverse(): boolean {
    return this._reverse;
  }

  get isFinished(): boolean {
    return this._isFinished;
  }

  constructor(numFrames: number) {
    this._numFrames = numFrames;
    this._frameRange = [0, numFrames];
  }

  play(options: KeyframeAnimationOptions = {}) {
    const { startFrame, endFrame, beginFromCurrentState, advanceTo } = options;

    if (startFrame !== undefined && endFrame !== undefined) {
      if (startFrame < 0 || startFrame >= this._numFrames) {
        throw new Error('Invalid start frame');
      }

      if (endFrame < 0 || endFrame >= this._numFrames) {
        throw new Error('Invalid end frame');
      }

      if (startFrame < endFrame) {
        this._frameRange = [startFrame, endFrame];
      } else {
        this._frameRange = [endFrame, startFrame];
      }
    } else {
      this._frameRange = [0, this._numFrames - 1];
    }

    if (!beginFromCurrentState || this._isFirstRun) {
      this._currentFrame = this._frameRange[this._reverse ? 1 : 0];
    }

    if (this._isFirstRun) {
      this._isFirstRun = false;
    }

    if (advanceTo === 'end') {
      this._currentFrame = this._frameRange[this._reverse ? 0 : 1];
    }

    this._isRunning = true;
    this._isFinished = false;

    this._unscheduleUpdate();

    this._render();
    this._scheduleUpdate();
  }

  stop() {
    this._isRunning = false;
    this._unscheduleUpdate();
  }

  _unscheduleUpdate() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  }

  _scheduleUpdate() {
    this._timeout = setTimeout(() => this._onUpdateFrame(), this._speed);
  }

  _render() {
    if (this._onFrame) {
      this._onFrame(this._currentFrame);
    }
  }

  _didFinish() {
    this._isFinished = true;

    if (this._onFinish) {
      this._onFinish();
    }
  }

  _onUpdateFrame() {
    this._advanceFrame();

    if (this._isFinished) {
      // mark animation as not running when finished
      this._isRunning = false;
    } else {
      this._render();

      // check once again since onFrame() may stop animation
      if (this._isRunning) {
        this._scheduleUpdate();
      }
    }
  }

  _advanceFrame() {
    if (this._isFinished) {
      return;
    }

    const lastFrame = this._frameRange[this._reverse ? 0 : 1];
    if (this._currentFrame === lastFrame) {
      this._didFinish();
    } else {
      this._currentFrame = this._nextFrame(this._currentFrame, this._frameRange, this._reverse);
    }
  }

  _nextFrame(cur: number, frameRange: KeyframeAnimationRange, isReverse: boolean): number {
    if (isReverse) {
      if (cur < frameRange[0]) {
        return cur + 1;
      } else if (cur > frameRange[0]) {
        return cur - 1;
      }
    } else {
      if (cur > frameRange[1]) {
        return cur - 1;
      } else if (cur < frameRange[1]) {
        return cur + 1;
      }
    }
    return cur;
  }
}
