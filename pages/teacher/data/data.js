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
    activeTab: 'overview',
    stats: { studentCount: 0, paperCount: 0, submittedCount: 0, pendingStudents: 0, participation: 0, avg: 0 },
    weakKps: [],
    classOverview: [],
    papers: [],
    reports: []
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
      const classes = boot.classes || [];
      if (!classes.length) {
        this.setData({ loading: false, error: '当前账号还没有负责的教学班', user: boot.user });
        return;
      }
      let current = api.getCurrentClassId();
      if (!data.findClass(boot, current)) {
        current = boot.user.classId && data.findClass(boot, boot.user.classId) ? boot.user.classId : classes[0].id;
        api.setCurrentClassId(current);
      }
      this.boot = boot;
      this.setData({ loading: false, error: '', user: boot.user, classes: classes });
      this.render(boot, current);
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载数据失败' });
    });
  },

  render(boot, classId) {
    const cls = data.findClass(boot, classId);
    const stats = data.classStats(boot, classId);
    const weakKps = data.kpMastery(boot, classId, 6);
    const classOverview = (boot.classes || []).map((c) => {
      const cs = data.classStats(boot, c.id);
      return {
        id: c.id,
        name: c.name,
        studentCount: cs.studentCount,
        paperCount: cs.paperCount,
        participation: cs.participation,
        avg: cs.avg,
        current: c.id === classId
      };
    });
    const papers = data.teacherPapers(boot, classId).map((p) => {
      const status = data.paperStatus(p, data.serverNow(boot));
      const ps = data.paperStats(boot, p);
      return {
        id: p.id,
        name: p.name,
        statusLabel: status.label,
        statusTone: status.tone,
        questionCount: (p.items || []).length,
        total: data.paperTotal(p),
        completion: ps.completion,
        submitted: ps.submitted,
        expected: ps.expected,
        avg: ps.avg,
        timeText: data.formatRange(p)
      };
    }).sort((a, b) => {
      const pa = data.findPaper(boot, a.id);
      const pb = data.findPaper(boot, b.id);
      return (data.parseTime(pb && pb.publishedAt) || 0) - (data.parseTime(pa && pa.publishedAt) || 0);
    });

    const paperMap = {};
    papers.forEach((p) => { paperMap[p.id] = p; });
    const studentIds = {};
    data.teacherStudents(boot, classId).forEach((s) => { studentIds[s.id] = true; });
    const reports = (boot.attempts || []).filter((a) => {
      return a.status === 'submitted' && paperMap[a.paperId] && studentIds[a.studentId];
    }).map((a) => {
      const student = data.findStudent(boot, a.studentId);
      const paper = data.findPaper(boot, a.paperId);
      const rate = data.pct(a.score, a.total);
      return {
        id: a.id,
        studentName: student ? student.name : '—',
        studentNo: student ? student.no : '',
        initial: student ? String(student.name || '?').substring(0, 1) : '?',
        paperName: paper ? paper.name : '—',
        score: a.score,
        total: a.total,
        rate: rate,
        grade: data.gradeLabel(rate),
        tone: rate < 60 ? 'red' : (rate < 80 ? 'amber' : 'green'),
        submittedText: data.formatDate(a.submittedAt, true)
      };
    }).sort((a, b) => {
      const ta = data.parseTime((data.findAttempt(boot, a.id) || {}).submittedAt);
      const tb = data.parseTime((data.findAttempt(boot, b.id) || {}).submittedAt);
      return tb - ta;
    }).slice(0, 20);

    this.setData({
      currentClassId: classId,
      currentClassName: cls ? cls.name : '',
      stats: stats,
      weakKps: weakKps,
      classOverview: classOverview,
      papers: papers,
      reports: reports
    });
  },

  onClassChange(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    api.setCurrentClassId(id);
    if (this.boot) this.render(this.boot, id);
  },

  setTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  switchClass(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.currentClassId) return;
    api.setCurrentClassId(id);
    if (this.boot) this.render(this.boot, id);
  },

  openReport(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(id) + '&mode=teacher' });
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
