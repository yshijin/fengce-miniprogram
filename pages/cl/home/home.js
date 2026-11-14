const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    activeTab: 'overview',
    overview: { courses: 0, classes: 0, students: 0, teachers: 0, papers: 0 },
    courses: [],
    classes: [],
    teachers: [],
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
      const allClasses = boot.classes || [];
      const allPapers = boot.papers || [];
      const courses = (boot.courses || []).map((c) => {
        return {
          id: c.id,
          name: c.name,
          code: c.code,
          term: c.term,
          owner: c.owner,
          statusLabel: c.status === 'active' ? '进行中' : c.status,
          classCount: allClasses.filter((x) => x.courseId === c.id).length,
          initial: String(c.name || '?').substring(0, 1)
        };
      });
      const classes = allClasses.map((c) => {
        const cs = data.classStats(boot, c.id);
        const paperCount = allPapers.filter((p) => {
          return !p.ownerStudentId && (p.classIds || []).indexOf(c.id) >= 0;
        }).length;
        return {
          id: c.id,
          name: c.name,
          teacherName: c.teacherName || '未分配',
          studentCount: cs.studentCount,
          paperCount: paperCount,
          participation: cs.participation,
          avg: cs.avg,
          major: c.major || '—',
          term: c.term || '—',
          initial: String(c.name || '?').substring(0, 1)
        };
      });
      const teachers = (boot.teachers || []).map((t) => {
        return {
          id: t.id,
          no: t.no,
          name: t.name,
          classes: t.classes || '暂未分配教学班',
          phone: t.phone || '—',
          statusLabel: t.status === 'active' ? '在职' : (t.status || '—'),
          initial: String(t.name || '?').substring(0, 1)
        };
      });
      const logs = (boot.logs || []).slice(0, 10).map((l) => {
        return {
          id: l.id,
          operator: l.operator,
          role: l.role,
          action: l.action,
          detail: l.detail,
          timeText: data.formatDate(l.time, true)
        };
      });
      this.setData({
        loading: false,
        error: '',
        user: boot.user,
        overview: {
          courses: courses.length,
          classes: classes.length,
          students: (boot.students || []).length,
          teachers: teachers.length,
          papers: allPapers.filter((p) => !p.ownerStudentId).length
        },
        courses: courses,
        classes: classes,
        teachers: teachers,
        logs: logs
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载课程数据失败' });
    });
  },

  setTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  reload() {
    this.load(true);
  }
});
