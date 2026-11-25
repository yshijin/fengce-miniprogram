const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    greeting: '',
    className: '',
    stats: { pending: 0, completed: 0, avg: 0 },
    sections: [],
    hasAny: false
  },

  onShow() {
    this.load(false);
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load(force) {
    if (!force) this.setData({ loading: !this.data.user, error: '' });
    else this.setData({ loading: false, error: '' });
    return api.loadBootstrap(force).then((boot) => {
      const user = boot.user;
      const now = data.serverNow(boot);
      const papers = data.myPapers(boot);
      const attempts = data.studentAttempts(boot, user.id);
      const submitted = attempts.filter((a) => a.status === 'submitted');
      const ongoing = [];
      const upcoming = [];
      const ended = [];

      papers.forEach((p) => {
        const status = data.paperStatus(p, now);
        const attempt = data.attemptOf(boot, p.id, user.id);
        const submittedAttempt = attempt && attempt.status === 'submitted';
        const total = data.paperTotal(p);
        const view = {
          id: p.id,
          name: p.name,
          teacherName: p.teacherName || '教师',
          className: data.classNamesForPaper(boot, p),
          questionCount: (p.items || []).length,
          total: total,
          statusLabel: submittedAttempt ? '已完成' : status.label,
          statusTone: submittedAttempt ? 'green' : status.tone,
          timeText: data.formatRange(p),
          attemptId: attempt ? attempt.id : '',
          scoreText: submittedAttempt ? (attempt.score + ' / ' + attempt.total) : '',
          scoreRate: submittedAttempt ? data.pct(attempt.score, attempt.total) : 0,
          action: '',
          actionLabel: ''
        };

        if (status.key === 'ongoing') {
          if (submittedAttempt) {
            view.action = 'view';
            view.actionLabel = '查看结果';
          } else if (attempt) {
            view.action = 'continue';
            view.actionLabel = '继续作答';
          } else {
            view.action = 'start';
            view.actionLabel = '开始评测';
          }
          ongoing.push(view);
        } else if (status.key === 'upcoming') {
          view.action = 'wait';
          view.actionLabel = '尚未开始';
          upcoming.push(view);
        } else {
          view.action = submittedAttempt ? 'view' : (attempt ? 'continue' : 'ended');
          view.actionLabel = submittedAttempt ? '查看结果' : (attempt ? '补交' : '已结束');
          ended.push(view);
        }
      });

      ongoing.sort((a, b) => {
        const pa = data.findPaper(boot, a.id);
        const pb = data.findPaper(boot, b.id);
        return (data.parseTime(pa && pa.endAt) || 0) - (data.parseTime(pb && pb.endAt) || 0);
      });
      upcoming.sort((a, b) => {
        const pa = data.findPaper(boot, a.id);
        const pb = data.findPaper(boot, b.id);
        return (data.parseTime(pa && pa.startAt) || 0) - (data.parseTime(pb && pb.startAt) || 0);
      });
      ended.sort((a, b) => {
        const pa = data.findPaper(boot, a.id);
        const pb = data.findPaper(boot, b.id);
        return (data.parseTime(pb && pb.endAt) || 0) - (data.parseTime(pa && pa.endAt) || 0);
      });

      const pending = ongoing.filter((p) => p.action !== 'view').length;
      const cls = data.findClass(boot, user.classId);
      const hour = new Date().getHours();
      const greeting = hour < 12 ? '早上好' : (hour < 18 ? '下午好' : '晚上好');
      const sections = [
        { key: 'ongoing', title: '进行中的评测', items: ongoing },
        { key: 'upcoming', title: '即将开始', items: upcoming },
        { key: 'ended', title: '已结束', items: ended.slice(0, 8) }
      ];

      this.setData({
        loading: false,
        error: '',
        user: user,
        className: cls ? cls.name : '',
        greeting: greeting,
        stats: {
          pending: pending,
          completed: submitted.length,
          avg: data.avgPct(submitted)
        },
        sections: sections,
        hasAny: papers.length > 0
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载失败' });
    });
  },

  onPaperTap(e) {
    const action = e.currentTarget.dataset.action;
    const paperId = e.currentTarget.dataset.id;
    const attemptId = e.currentTarget.dataset.attempt;
    if (action === 'view' && attemptId) {
      wx.navigateTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(attemptId) });
      return;
    }
    if (action === 'start' || action === 'continue') {
      wx.navigateTo({ url: '/pages/student/exam/exam?paperId=' + encodeURIComponent(paperId) });
      return;
    }
    if (action === 'wait') {
      wx.showToast({ title: '评测尚未开始', icon: 'none' });
      return;
    }
    wx.showToast({ title: '该评测已结束', icon: 'none' });
  },

  goHistory() {
    wx.reLaunch({ url: '/pages/student/history/history' });
  },

  goWrongbook() {
    wx.reLaunch({ url: '/pages/student/wrongbook/wrongbook' });
  },

  reload() {
    this.load(true);
  }
});
