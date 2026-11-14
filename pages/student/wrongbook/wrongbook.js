const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    summary: { total: 0, corrected: 0, remaining: 0, paperCount: 0, kpCount: 0 },
    filter: 'remaining',
    tabs: [],
    entries: [],
    selectedCount: 0,
    allSelected: false,
    generating: false
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
      const wb = boot.wrongBook || { entries: [], total: 0, corrected: 0, remaining: 0, paperCount: 0, kpCount: 0 };
      this.boot = boot;
      this.selectedMap = this.selectedMap || {};
      this.expandedMap = this.expandedMap || {};
      this.allEntries = (wb.entries || []).map((entry, index) => {
        const options = data.optionViews(entry, entry.myAnswer, entry.answer, !!entry.answerVisible);
        return Object.assign({}, entry, {
          number: index + 1,
          typeLabel: entry.type === 'multi' ? '多选题' : (entry.type === 'judge' ? '判断题' : '单选题'),
          myAnswerText: data.answerText(entry, entry.myAnswer),
          correctAnswerText: data.answerText(entry, entry.answer),
          options: options,
          selected: !!this.selectedMap[entry.qid],
          expanded: !!this.expandedMap[entry.qid]
        });
      });
      const valid = {};
      this.allEntries.forEach((entry) => { valid[entry.qid] = true; });
      Object.keys(this.selectedMap).forEach((qid) => {
        if (!valid[qid]) delete this.selectedMap[qid];
      });
      this.setData({
        loading: false,
        error: '',
        user: boot.user,
        summary: {
          total: wb.total || 0,
          corrected: wb.corrected || 0,
          remaining: wb.remaining || 0,
          paperCount: wb.paperCount || 0,
          kpCount: wb.kpCount || 0
        }
      });
      this.refreshList();
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载错题本失败' });
    });
  },

  refreshList() {
    const all = this.allEntries || [];
    const filter = this.data.filter;
    const filtered = all.filter((entry) => {
      if (filter === 'remaining') return !entry.corrected;
      if (filter === 'corrected') return !!entry.corrected;
      return true;
    });
    const selectedCount = all.filter((entry) => entry.selected).length;
    const allSelected = filtered.length > 0 && filtered.every((entry) => entry.selected);
    const tabs = [
      { key: 'remaining', label: '待掌握', count: all.filter((e) => !e.corrected).length },
      { key: 'corrected', label: '已纠正', count: all.filter((e) => !!e.corrected).length },
      { key: 'all', label: '全部', count: all.length }
    ];
    this.setData({
      entries: filtered,
      selectedCount: selectedCount,
      allSelected: allSelected,
      tabs: tabs
    });
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    if (!filter || filter === this.data.filter) return;
    this.setData({ filter: filter });
    this.refreshList();
  },

  toggleSelect(e) {
    const qid = e.currentTarget.dataset.qid;
    if (!qid) return;
    if (this.selectedMap[qid]) delete this.selectedMap[qid];
    else this.selectedMap[qid] = true;
    this.syncSelection();
  },

  syncSelection() {
    const all = this.allEntries || [];
    all.forEach((entry) => {
      entry.selected = !!this.selectedMap[entry.qid];
    });
    this.refreshList();
  },

  selectAll() {
    const filtered = (this.allEntries || []).filter((entry) => {
      if (this.data.filter === 'remaining') return !entry.corrected;
      if (this.data.filter === 'corrected') return !!entry.corrected;
      return true;
    });
    const shouldSelect = !this.data.allSelected;
    if (!shouldSelect) {
      filtered.forEach((entry) => { delete this.selectedMap[entry.qid]; });
      this.syncSelection();
      return;
    }
    const current = Object.keys(this.selectedMap).length;
    let room = 100 - current;
    if (room <= 0) {
      wx.showToast({ title: '单次最多选择 100 道题', icon: 'none' });
      return;
    }
    filtered.forEach((entry) => {
      if (room > 0 && !this.selectedMap[entry.qid]) {
        this.selectedMap[entry.qid] = true;
        room -= 1;
      }
    });
    this.syncSelection();
    if (filtered.length > 100) wx.showToast({ title: '已选前 100 道题', icon: 'none' });
  },

  toggleExpand(e) {
    const qid = e.currentTarget.dataset.qid;
    if (!qid) return;
    this.expandedMap[qid] = !this.expandedMap[qid];
    (this.allEntries || []).forEach((entry) => {
      if (entry.qid === qid) entry.expanded = !!this.expandedMap[qid];
    });
    this.refreshList();
  },

  generate() {
    if (this.data.generating) return;
    let qids = Object.keys(this.selectedMap || {});
    if (!qids.length) {
      const remaining = (this.allEntries || []).filter((e) => !e.corrected);
      const count = Math.min(remaining.length, 100);
      if (!count) {
        wx.showToast({ title: '暂无可重练的错题', icon: 'none' });
        return;
      }
      wx.showModal({
        title: '生成错题重练',
        content: '尚未选择题目，是否使用全部 ' + count + ' 道待掌握错题生成测试？',
        confirmText: '生成',
        success: (res) => {
          if (!res.confirm) return;
          this.doGenerate(remaining.slice(0, count).map((e) => e.qid));
        }
      });
      return;
    }
    if (qids.length > 100) {
      qids = qids.slice(0, 100);
      wx.showToast({ title: '单次最多 100 道题', icon: 'none' });
    }
    this.doGenerate(qids);
  },

  doGenerate(qids) {
    this.setData({ generating: true });
    wx.showLoading({ title: '正在生成', mask: true });
    api.createWrongTest(qids).then((res) => {
      const paperId = res && res.paper ? res.paper.id : '';
      return api.loadBootstrap(true).then(() => paperId);
    }).then((paperId) => {
      wx.hideLoading();
      this.setData({ generating: false });
      if (!paperId) throw new Error('生成失败，请稍后重试');
      wx.showToast({ title: '已生成错题测试', icon: 'success' });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/student/exam/exam?paperId=' + encodeURIComponent(paperId) });
      }, 450);
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ generating: false });
      wx.showModal({
        title: '生成失败',
        content: err.message || '请稍后重试',
        showCancel: false
      });
    });
  },

  reload() {
    this.load(true);
  }
});
