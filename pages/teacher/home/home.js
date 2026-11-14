const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    classes: [],
    currentClassId: '',
    currentClassName: '',
    courseName: '',
    stats: { studentCount: 0, paperCount: 0, submittedCount: 0, avg: 0, participation: 0, pendingStudents: 0 },
    recentPapers: [],
    logs: []
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
      const classes = boot.classes || [];
      if (!classes.length) {
        this.setData({ loading: false, error: '当前账号还没有负责的教学班', user: user });
        return;
      }
      let current = api.getCurrentClassId();
      if (!data.findClass(boot, current)) {
        current = user.classId && data.findClass(boot, user.classId) ? user.classId : classes[0].id;
        api.setCurrentClassId(current);
      }
      this.boot = boot;
      this.render(boot, current);
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载工作台失败' });
    });
  },

  render(boot, classId) {
    const cls = data.findClass(boot, classId);
    const stats = data.classStats(boot, classId);
    const papers = data.teacherPapers(boot, classId).map((p) => {
      const status = data.paperStatus(p, data.serverNow(boot));
      const pstats = data.paperStats(boot, p);
      return {
        id: p.id,
        name: p.name,
        statusLabel: status.label,
        statusTone: status.tone,
        questionCount: (p.items || []).length,
        total: data.paperTotal(p),
        completion: pstats.completion,
        submitted: pstats.submitted,
        expected: pstats.expected,
        timeText: data.formatRange(p)
      };
    }).sort((a, b) => {
      const pa = data.findPaper(boot, a.id);
      const pb = data.findPaper(boot, b.id);
      return (data.parseTime(pb && pb.publishedAt) || data.parseTime(pb && pb.startAt) || 0) -
        (data.parseTime(pa && pa.publishedAt) || data.parseTime(pa && pa.startAt) || 0);
    });
    const course = (boot.courses || []).filter((c) => c.id === boot.user.courseId)[0];
    const logs = (boot.logs || []).slice(0, 5).map((l) => ({
      id: l.id,
      action: l.action,
      detail: l.detail,
      timeText: data.formatDate(l.time, true)
    }));
    this.setData({
      loading: false,
      error: '',
      user: boot.user,
      classes: boot.classes || [],
      currentClassId: classId,
      currentClassName: cls ? cls.name : '',
      courseName: course ? course.name : '课程',
      stats: stats,
      recentPapers: papers.slice(0, 4),
      logs: logs
    });
  },

  onClassChange(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    api.setCurrentClassId(id);
    this.setData({ currentClassId: id });
    if (this.boot) this.render(this.boot, id);
  },

  goStudents() {
    wx.reLaunch({ url: '/pages/teacher/students/students' });
  },

  goPapers() {
    wx.reLaunch({ url: '/pages/teacher/papers/papers' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/teacher/create/create' });
  },

  goData() {
    wx.reLaunch({ url: '/pages/teacher/data/data' });
  },

  openPaper(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/teacher/progress/progress?paperId=' + encodeURIComponent(id) });
  },

  reload() {
    this.load(true);
  }
});
