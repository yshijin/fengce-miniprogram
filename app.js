App({
  globalData: {
    user: null,
    boot: null,
    bootAt: 0,
    serverOffset: 0
  },

  onLaunch() {
    const user = wx.getStorageSync('zx_user');
    if (user) this.globalData.user = user;
  }
});
