const api = require('../../utils/api');

Page({
  onLoad() {
    const token = api.getToken();
    const user = api.getUser();
    if (token && user) {
      wx.reLaunch({ url: api.homeFor(user.role) });
      return;
    }
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
