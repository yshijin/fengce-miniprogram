const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    stats: { count: 0, avg: 0, best: 0 },
    attempts: []
  },

  onShow() {
    this.load(false);
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load(force) {
    if (!force) this.setData({ loading: !this.data.user, error: '' });
    return api.loadBootstrap(force).then((boot) => {
      const user = boot.user;
      const list = data.studentAttempts(boot, user.id)
        .filter((a) => a.status === 'submitted')
        .map((a) => {
          const paper = data.findPaper(boot, a.paperId);
          const rate = data.pct(a.score, a.total);
          return {
            id: a.id,
            paperName: paper ? paper.name : '已删除的试卷',
            paperClass: paper ? data.classNamesForPaper(boot, paper) : '—',
            score: a.score,
            total: a.total,
            rate: rate,
            grade: data.gradeLabel(rate),
            timeUsed: a.timeUsed || 0,
            submittedAt: a.submittedAt,
            submittedText: data.formatDate(a.submittedAt, true),
            tone: rate < 60 ? 'red' : (rate < 80 ? 'amber' : 'green')
          };
        })
        .sort((a, b) => {
          const ta = data.parseTime(a.submittedAt);
          const tb = data.parseTime(b.submittedAt);
          return tb - ta;
        });
      const rates = list.map((x) => x.rate);
      this.setData({
        loading: false,
        error: '',
        user: user,
        attempts: list,
        stats: {
          count: list.length,
          avg: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0,
          best: rates.length ? Math.max.apply(null, rates) : 0
        }
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载成绩失败' });
    });
  },

  openResult(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(id) });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/student/home/home' });
  },

  reload() {
    this.load(true);
  }
});
