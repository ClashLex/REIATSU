import { Bus } from './event-bus.js';

export const StateMachine = {
  current: 'neutral',

  transitionTo(state) {
    if (this.current === state) return;
    const old = this.current;
    this.current = state;
    Bus.emit('tech:change', { current: state, old });
  },

  get() {
    return this.current;
  }
};
