const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    paper: null,
    stats: { expected: 0, submitted: 0, inProgress: 0, notStarted: 0, avg: 0, max: 0, min: 0, completion: 0 },
    rows: [],
    keyword: '',
    allRows: [],
    canEnd: false,
    ending: false
  },

  onLoad(options) {
    this.paperId = options && options.paperId ? options.paperId : '';
    if (!this.paperId) {
      this.setData({ loading: false, error: '缺少试卷编号' });
      return;
    }
    this.load();
  },

  load() {
    this.setData({ loading: true, error: '' });
    api.loadBootstrap(true).then((boot) => {
      const paper = data.findPaper(boot, this.paperId);
      if (!paper) {
        this.setData({ loading: false, error: '试卷不存在或已删除' });
        return;
      }
      const status = data.paperStatus(paper, data.serverNow(boot));
      const stats = data.paperStats(boot, paper);
      const allRows = data.reportRows(boot, paper).map((row) => {
        return {
          studentId: row.student.id,
          name: row.student.name,
          no: row.student.no,
          initial: String(row.student.name || '?').substring(0, 1),
          className: (data.findClass(boot, row.student.classId) || {}).name || '—',
          status: row.status,
          statusLabel: row.statusLabel,
          statusTone: row.statusTone,
          score: row.score,
          total: row.total,
          rate: row.rate,
          timeUsed: row.timeUsed,
          submittedText: row.submittedText,
          attemptId: row.attempt ? row.attempt.id : '',
          tone: row.rate < 60 ? 'red' : (row.rate < 80 ? 'amber' : 'green')
        };
      });
      this.setData({
        loading: false,
        error: '',
        paper: {
          id: paper.id,
          name: paper.name,
          className: data.classNamesForPaper(boot, paper),
          timeText: data.formatRange(paper),
          statusLabel: status.label,
          statusTone: status.tone,
          total: data.paperTotal(paper),
          questionCount: (paper.items || []).length
        },
        stats: stats,
        allRows: allRows,
        rows: allRows,
        canEnd: status.key === 'ongoing'
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载测评数据失败' });
    });
  },

  onSearch(e) {
    const keyword = String(e.detail.value || '').trim().toLowerCase();
    const rows = this.data.allRows.filter((row) => {
      if (!keyword) return true;
      return String(row.name || '').toLowerCase().indexOf(keyword) >= 0 ||
        String(row.no || '').toLowerCase().indexOf(keyword) >= 0;
    });
    this.setData({ keyword: e.detail.value, rows: rows });
  },

  clearSearch() {
    this.setData({ keyword: '', rows: this.data.allRows });
  },

  openReport(e) {
    const id = e.currentTarget.dataset.attempt;
    if (!id) return;
    wx.navigateTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(id) + '&mode=teacher' });
  },

  endPaper() {
    if (this.data.ending || !this.data.canEnd) return;
    wx.showModal({
      title: '结束测评',
      content: '结束后学生将不能继续作答，确定结束吗？',
      confirmText: '结束',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ ending: true });
        api.endPaper(this.data.paper.id).then(() => {
          wx.showToast({ title: '已结束测评', icon: 'success' });
          this.setData({ ending: false });
          return this.load();
        }).catch((err) => {
          this.setData({ ending: false });
          wx.showModal({ title: '操作失败', content: err.message || '请稍后重试', showCancel: false });
        });
      }
    });
  },

  back() {
    wx.navigateBack({ delta: 1, fail() { wx.reLaunch({ url: '/pages/teacher/papers/papers' }); } });
  },

  reload() {
    this.load();
  }
});
