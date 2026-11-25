const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    classes: [],
    classNames: ['全部教学班'],
    classIndex: 0,
    filter: 'all',
    totalCount: 0,
    tabs: [],
    papers: []
  },

  onShow() {
    this.load(true);
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load(force) {
    if (!force) this.setData({ loading: !this.data.user, error: '' });
    return api.loadBootstrap(force).then((boot) => {
      if (!boot.user || boot.user.role !== 'course_leader') {
        this.setData({ loading: false, error: '当前账号没有评测管理权限', user: boot.user });
        return;
      }
      const classes = boot.classes || [];
      this.boot = boot;
      this.setData({
        loading: false,
        error: '',
        user: boot.user,
        classes: classes,
        classNames: ['全部教学班'].concat(classes.map((c) => c.name))
      });
      this.render();
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载评测失败' });
    });
  },

  render() {
    const boot = this.boot;
    if (!boot) return;
    const classes = boot.classes || [];
    const classIndex = this.data.classIndex;
    const classId = classIndex > 0 && classes[classIndex - 1] ? classes[classIndex - 1].id : '';
    const raw = (boot.papers || []).filter((p) => {
      if (p.ownerStudentId) return false;
      if (classId && (p.classIds || []).indexOf(classId) < 0) return false;
      return true;
    }).map((p) => {
      const status = data.paperStatus(p, data.serverNow(boot));
      const pstats = data.paperStats(boot, p);
      return {
        id: p.id,
        name: p.name,
        className: data.classNamesForPaper(boot, p),
        statusKey: status.key,
        statusLabel: status.label,
        statusTone: status.tone,
        questionCount: (p.items || []).length,
        total: data.paperTotal(p),
        timeText: data.formatRange(p),
        submitted: pstats.submitted,
        expected: pstats.expected,
        completion: pstats.completion,
        avg: pstats.avg,
        canEnd: status.key === 'ongoing',
        canDelete: true
      };
    }).sort((a, b) => {
      const pa = data.findPaper(boot, a.id);
      const pb = data.findPaper(boot, b.id);
      return (data.parseTime(pb && pb.publishedAt) || data.parseTime(pb && pb.startAt) || 0) -
        (data.parseTime(pa && pa.publishedAt) || data.parseTime(pa && pa.startAt) || 0);
    });
    const counts = { all: raw.length, ongoing: 0, upcoming: 0, ended: 0, draft: 0 };
    raw.forEach((p) => {
      if (counts[p.statusKey] !== undefined) counts[p.statusKey] += 1;
    });
    const tabs = [
      { key: 'all', label: '全部', count: counts.all },
      { key: 'ongoing', label: '进行中', count: counts.ongoing },
      { key: 'upcoming', label: '未开始', count: counts.upcoming },
      { key: 'ended', label: '已结束', count: counts.ended },
      { key: 'draft', label: '草稿', count: counts.draft }
    ];
    const filter = this.data.filter;
    const list = filter === 'all' ? raw : raw.filter((p) => p.statusKey === filter);
    this.setData({
      totalCount: raw.length,
      tabs: tabs,
      papers: list
    });
  },

  onClassFilter(e) {
    this.setData({ classIndex: Number(e.detail.value) || 0 });
    this.render();
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    if (!filter || filter === this.data.filter) return;
    this.setData({ filter: filter });
    this.render();
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/cl/create/create' });
  },

  openProgress(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/teacher/progress/progress?paperId=' + encodeURIComponent(id) });
  },

  endPaper(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '结束评测',
      content: '结束后学员将不能继续作答，确定结束吗？',
      confirmText: '结束',
      success: (res) => {
        if (!res.confirm) return;
        api.endPaper(id).then(() => {
          wx.showToast({ title: '已结束评测', icon: 'success' });
          return this.load(true);
        }).catch((err) => {
          wx.showModal({ title: '操作失败', content: err.message || '请稍后重试', showCancel: false });
        });
      }
    });
  },

  deletePaper(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除评测',
      content: '删除后相关作答记录也会被清理，且无法恢复。确定删除吗？',
      confirmText: '删除',
      confirmColor: '#b33a32',
      success: (res) => {
        if (!res.confirm) return;
        api.deletePaper(id).then(() => {
          wx.showToast({ title: '已删除评测', icon: 'success' });
          return this.load(true);
        }).catch((err) => {
          wx.showModal({ title: '删除失败', content: err.message || '请稍后重试', showCancel: false });
        });
      }
    });
  },

  reload() {
    this.load(true);
  }
});
