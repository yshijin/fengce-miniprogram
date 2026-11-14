const api = require('../../utils/api');

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    version: api.config.version,
    quickAccounts: [
      { role: '学生', username: '20260001', password: '123456' },
      { role: '教师', username: 'zhaolin', password: '123456' },
      { role: '负责人', username: 'admin', password: '123456' }
    ]
  },

  onLoad(options) {
    if (options && options.expired) {
      wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
    }
    const token = api.getToken();
    const user = api.getUser();
    if (token && user) {
      wx.reLaunch({ url: api.homeFor(user.role) });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const patch = {};
    patch[field] = value;
    this.setData(patch);
  },

  fillAccount(e) {
    const account = this.data.quickAccounts[e.currentTarget.dataset.index];
    if (!account) return;
    this.setData({
      username: account.username,
      password: account.password
    });
    wx.showToast({ title: '已填入测试账号', icon: 'none' });
  },

  submit() {
    if (this.data.loading) return;
    const username = String(this.data.username || '').trim();
    const password = String(this.data.password || '');
    if (!username || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    api.login(username, password).then((res) => {
      this.setData({ loading: false });
      wx.showToast({ title: '登录成功', icon: 'success', duration: 600 });
      setTimeout(() => {
        wx.reLaunch({ url: api.homeFor(res.user.role) });
      }, 500);
    }).catch((err) => {
      this.setData({ loading: false });
      wx.showModal({
        title: '登录失败',
        content: err.message || '账号或密码错误',
        showCancel: false
      });
    });
  }
});
