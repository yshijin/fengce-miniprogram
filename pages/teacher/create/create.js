const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    classViews: [],
    kpViews: [],
    form: {
      name: '',
      duration: 30,
      days: 7,
      single: 6,
      multi: 2,
      judge: 2
    },
    available: { single: 0, multi: 0, judge: 0, total: 0 },
    summary: { total: 0, score: 0, classCount: 0, kpCount: 0 },
    publishing: false
  },

  onLoad() {
    this.load();
  },

  load() {
    this.setData({ loading: true, error: '' });
    api.loadBootstrap(false).then((boot) => {
      const classes = boot.classes || [];
      if (!classes.length) {
        this.setData({ loading: false, error: '当前账号还没有负责的教学班', user: boot.user });
        return;
      }
      let current = api.getCurrentClassId();
      if (!data.findClass(boot, current)) {
        current = boot.user.classId && data.findClass(boot, boot.user.classId) ? boot.user.classId : classes[0].id;
      }
      const kps = (boot.kps || []).filter((k) => k.status !== 'disabled');
      this.boot = boot;
      this.classViews = classes.map((c) => ({
        id: c.id,
        name: c.name,
        count: c.count || 0,
        selected: c.id === current
      }));
      this.kpViews = kps.map((k) => ({
        id: k.id,
        name: k.name,
        code: k.code,
        selected: true
      }));
      this.setData({
        loading: false,
        error: '',
        user: boot.user,
        classViews: this.classViews,
        kpViews: this.kpViews
      });
      this.recalculate();
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载组卷数据失败' });
    });
  },

  selectedKpIds() {
    return (this.kpViews || []).filter((k) => k.selected).map((k) => k.id);
  },

  selectedClassIds() {
    return (this.classViews || []).filter((c) => c.selected).map((c) => c.id);
  },

  recalculate() {
    const kpIds = this.selectedKpIds();
    const kpMap = {};
    kpIds.forEach((id) => { kpMap[id] = true; });
    const questions = (this.boot && this.boot.questions ? this.boot.questions : []).filter((q) => {
      return kpMap[q.kpId] && q.status !== 'disabled';
    });
    const counts = { single: 0, multi: 0, judge: 0 };
    questions.forEach((q) => {
      if (counts[q.type] !== undefined) counts[q.type] += 1;
    });
    const total = (Number(this.data.form.single) || 0) +
      (Number(this.data.form.multi) || 0) + (Number(this.data.form.judge) || 0);
    this.setData({
      available: {
        single: counts.single,
        multi: counts.multi,
        judge: counts.judge,
        total: questions.length
      },
      summary: {
        total: total,
        score: total * 10,
        classCount: this.selectedClassIds().length,
        kpCount: kpIds.length
      }
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['form.' + field] = e.detail.value;
    this.setData(patch);
    if (field === 'duration' || field === 'days') return;
    this.recalculate();
  },

  onCountInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = data.clamp(e.detail.value, 0, 30);
    const patch = {};
    patch['form.' + field] = value;
    this.setData(patch);
    this.recalculate();
  },

  adjustCount(e) {
    const field = e.currentTarget.dataset.field;
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    const value = data.clamp((Number(this.data.form[field]) || 0) + delta, 0, 30);
    const patch = {};
    patch['form.' + field] = value;
    this.setData(patch);
    this.recalculate();
  },

  toggleClass(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.classViews = this.classViews.map((c) => {
      return c.id === id ? Object.assign({}, c, { selected: !c.selected }) : c;
    });
    this.setData({ classViews: this.classViews });
    this.recalculate();
  },

  toggleKp(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.kpViews = this.kpViews.map((k) => {
      return k.id === id ? Object.assign({}, k, { selected: !k.selected }) : k;
    });
    this.setData({ kpViews: this.kpViews });
    this.recalculate();
  },

  selectAllKps() {
    this.kpViews = this.kpViews.map((k) => Object.assign({}, k, { selected: true }));
    this.setData({ kpViews: this.kpViews });
    this.recalculate();
  },

  clearKps() {
    this.kpViews = this.kpViews.map((k) => Object.assign({}, k, { selected: false }));
    this.setData({ kpViews: this.kpViews });
    this.recalculate();
  },

  defaultName() {
    const d = new Date();
    return '锋测 · ' + data.pad2(d.getMonth() + 1) + '-' + data.pad2(d.getDate()) +
      ' ' + data.pad2(d.getHours()) + ':' + data.pad2(d.getMinutes());
  },
  publish() {
    if (this.data.publishing) return;
    const classIds = this.selectedClassIds();
    const kpIds = this.selectedKpIds();
    const form = this.data.form;
    const single = Number(form.single) || 0;
    const multi = Number(form.multi) || 0;
    const judge = Number(form.judge) || 0;
    const total = single + multi + judge;
    if (!classIds.length) {
      wx.showToast({ title: '请选择目标教学班', icon: 'none' });
      return;
    }
    if (!kpIds.length) {
      wx.showToast({ title: '请选择知识点范围', icon: 'none' });
      return;
    }
    if (!total) {
      wx.showToast({ title: '请至少选择一道题', icon: 'none' });
      return;
    }
    if (single > this.data.available.single || multi > this.data.available.multi || judge > this.data.available.judge) {
      wx.showToast({ title: '部分题型可用题量不足', icon: 'none' });
      return;
    }

    const kpMap = {};
    kpIds.forEach((id) => { kpMap[id] = true; });
    const pool = (this.boot.questions || []).filter((q) => {
      return kpMap[q.kpId] && q.status !== 'disabled';
    });
    const pick = (type, count) => {
      if (!count) return [];
      return data.shuffle(pool.filter((q) => q.type === type)).slice(0, count).map((q) => ({
        qid: q.id,
        score: 10
      }));
    };
    let items = [];
    items = items.concat(pick('single', single));
    items = items.concat(pick('multi', multi));
    items = items.concat(pick('judge', judge));
    if (items.length !== total) {
      wx.showToast({ title: '题目数量不足，请调整范围', icon: 'none' });
      return;
    }
    items = data.shuffle(items);
    const now = new Date();
    const duration = data.clamp(form.duration, 5, 180);
    const days = data.clamp(form.days, 1, 30);
    const endAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const name = String(form.name || '').trim() || this.defaultName();

    this.setData({ publishing: true });
    wx.showLoading({ title: '正在发布', mask: true });
    api.createPaper({
      name: name,
      classIds: classIds,
      items: items,
      duration: duration,
      attemptsAllowed: 1,
      answerPolicy: 'afterSubmit',
      shuffle: false,
      startAt: now.toISOString(),
      endAt: endAt.toISOString()
    }).then(() => {
      return api.loadBootstrap(true);
    }).then(() => {
      api.setCurrentClassId(classIds[0]);
      wx.hideLoading();
      this.setData({ publishing: false });
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/teacher/papers/papers' });
      }, 450);
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ publishing: false });
      wx.showModal({
        title: '发布失败',
        content: err.message || '请检查题目和班级设置',
        showCancel: false
      });
    });
  },

  reload() {
    this.load();
  }
});
