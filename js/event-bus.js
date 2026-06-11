export const Bus = {
  _: {},
  on(e, f) {
    (this._[e] = this._[e] || []).push(f);
  },
  emit(e, d) {
    (this._[e] || []).forEach(f => f(d));
  }
};
