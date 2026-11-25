const api = require('../../../utils/api');
const data = require('../../../utils/data');

const TYPE_OPTIONS = [
  { key: 'single', label: '单选题' },
  { key: 'multi', label: '多选题' },
  { key: 'judge', label: '判断题' }
];

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: '基础' },
  { key: 'medium', label: '进阶' },
  { key: 'hard', label: '挑战' }
];

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    activeTab: 'kps',
    kps: [],
    questions: [],
    counts: { kps: 0, questions: 0 },
    kpNames: [],
    typeOptions: TYPE_OPTIONS,
    typeLabels: TYPE_OPTIONS.map((t) => t.label),
    typeIndex: 0,
    questionType: 'single',
    difficultyOptions: DIFFICULTY_OPTIONS,
    difficultyLabels: DIFFICULTY_OPTIONS.map((d) => d.label),
    difficultyIndex: 1,
    showKp: false,
    kpForm: { name: '', desc: '' },
    showQuestion: false,
    questionForm: { stem: '', answer: '', analysis: '' },
    optionKeys: ['A', 'B', 'C', 'D'],
    optionValues: ['', '', '', ''],
    judgeAnswerIndex: 0,
    judgeAnswers: ['正确', '错误'],
    kpIndex: 0,
    submitting: false
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
        this.setData({ loading: false, error: '当前账号没有题库管理权限', user: boot.user });
        return;
      }
      const allQuestions = (boot.questions || []).filter((q) => q.status !== 'disabled');
      const kpMap = {};
      (boot.kps || []).forEach((k) => { kpMap[k.id] = k; });
      const kps = (boot.kps || []).map((k) => {
        return {
          id: k.id,
          code: k.code || '—',
          name: k.name,
          desc: k.description || '暂无知识点说明',
          questionCount: allQuestions.filter((q) => q.kpId === k.id).length,
          initial: String(k.name || '?').substring(0, 1)
        };
      });
      const questions = allQuestions.map((q) => {
        const kp = kpMap[q.kpId];
        const type = TYPE_OPTIONS.find((t) => t.key === q.type);
        const diff = DIFFICULTY_OPTIONS.find((d) => d.key === q.difficulty);
        return {
          id: q.id,
          stem: q.stem,
          typeLabel: type ? type.label : q.type,
          kpName: kp ? kp.name : '未归属知识点',
          answer: q.answer || '—',
          difficultyLabel: diff ? diff.label : '未设置',
          initial: String(q.id || '?').substring(0, 1)
        };
      });
      this.boot = boot;
      this.setData({
        loading: false,
        error: '',
        user: boot.user,
        kps: kps,
        questions: questions,
        counts: { kps: kps.length, questions: questions.length },
        kpNames: kps.map((k) => k.name)
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载题库失败' });
    });
  },

  setTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  openKp() {
    this.setData({
      showKp: true,
      kpForm: { name: '', desc: '' }
    });
  },

  openQuestion() {
    if (!this.data.kps.length) {
      wx.showToast({ title: '请先新增知识点', icon: 'none' });
      return;
    }
    this.setData({
      showQuestion: true,
      kpIndex: 0,
      typeIndex: 0,
      questionType: 'single',
      difficultyIndex: 1,
      judgeAnswerIndex: 0,
      questionForm: { stem: '', answer: '', analysis: '' },
      optionValues: ['', '', '', '']
    });
  },

  closeAll() {
    if (this.data.submitting) return;
    this.setData({ showKp: false, showQuestion: false });
  },

  onFormInput(e) {
    const form = e.currentTarget.dataset.form;
    const field = e.currentTarget.dataset.field;
    if (!form || !field) return;
    const patch = {};
    patch[form + '.' + field] = e.detail.value;
    this.setData(patch);
  },

  onOptionInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (isNaN(index)) return;
    const values = this.data.optionValues.slice();
    values[index] = e.detail.value;
    this.setData({ optionValues: values });
  },

  onKpPick(e) {
    this.setData({ kpIndex: Number(e.detail.value) || 0 });
  },

  onTypePick(e) {
    const index = Number(e.detail.value) || 0;
    const type = TYPE_OPTIONS[index] || TYPE_OPTIONS[0];
    const patch = {
      typeIndex: index,
      questionType: type.key
    };
    if (type.key === 'judge') {
      patch['questionForm.answer'] = '';
    }
    this.setData(patch);
  },

  onDifficultyPick(e) {
    this.setData({ difficultyIndex: Number(e.detail.value) || 0 });
  },

  onJudgeAnswerPick(e) {
    this.setData({ judgeAnswerIndex: Number(e.detail.value) || 0 });
  },

  submitKp() {
    if (this.data.submitting) return;
    const name = String(this.data.kpForm.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写知识点名称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    api.addKp({
      name: name,
      desc: String(this.data.kpForm.desc || '').trim()
    }).then(() => {
      this.setData({ submitting: false, showKp: false });
      wx.showToast({ title: '知识点已新增', icon: 'success' });
      return this.load(true);
    }).catch((err) => {
      this.setData({ submitting: false });
      wx.showModal({ title: '新增失败', content: err.message || '请检查知识点名称', showCancel: false });
    });
  },

  submitQuestion() {
    if (this.data.submitting) return;
    const kp = this.data.kps[this.data.kpIndex];
    const type = this.data.questionType;
    const stem = String(this.data.questionForm.stem || '').trim();
    if (!kp) {
      wx.showToast({ title: '请选择知识点', icon: 'none' });
      return;
    }
    if (!stem) {
      wx.showToast({ title: '请填写题干', icon: 'none' });
      return;
    }

    let options = [];
    let answer = '';
    if (type === 'judge') {
      options = [
        { key: 'T', text: '正确' },
        { key: 'F', text: '错误' }
      ];
      answer = this.data.judgeAnswerIndex === 0 ? 'T' : 'F';
    } else {
      options = this.data.optionValues.map((text, index) => {
        return { key: this.data.optionKeys[index], text: String(text || '').trim() };
      }).filter((o) => o.text);
      if (options.length < 2) {
        wx.showToast({ title: '请至少填写两个选项', icon: 'none' });
        return;
      }
      answer = String(this.data.questionForm.answer || '').replace(/[^A-D]/gi, '').toUpperCase();
      if (!answer) {
        wx.showToast({ title: '请填写正确答案', icon: 'none' });
        return;
      }
      if (type === 'single' && answer.length !== 1) {
        wx.showToast({ title: '单选题答案只能有一个选项', icon: 'none' });
        return;
      }
      const validKeys = options.map((o) => o.key);
      for (let i = 0; i < answer.length; i += 1) {
        if (validKeys.indexOf(answer[i]) < 0) {
          wx.showToast({ title: '答案包含未填写的选项', icon: 'none' });
          return;
        }
      }
    }

    const difficulty = (this.data.difficultyOptions[this.data.difficultyIndex] || DIFFICULTY_OPTIONS[1]).key;
    this.setData({ submitting: true });
    api.addQuestion({
      stem: stem,
      type: type,
      answer: answer,
      kpId: kp.id,
      options: options,
      analysis: String(this.data.questionForm.analysis || '').trim(),
      difficulty: difficulty,
      real: false
    }).then(() => {
      this.setData({ submitting: false, showQuestion: false });
      wx.showToast({ title: '题目已新增', icon: 'success' });
      return this.load(true);
    }).catch((err) => {
      this.setData({ submitting: false });
      wx.showModal({ title: '新增失败', content: err.message || '请检查题目设置', showCancel: false });
    });
  },

  removeKp(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该知识点';
    wx.showModal({
      title: '删除知识点',
      content: '删除「' + name + '」会同时清理其下题目、使用这些题目的评测与作答记录，且无法恢复。确定继续吗？',
      confirmText: '删除',
      confirmColor: '#b33a32',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '正在清理', mask: true });
        api.deleteKp(id).then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          return this.load(true);
        }).catch((err) => {
          wx.hideLoading();
          wx.showModal({ title: '删除失败', content: err.message || '请稍后重试', showCancel: false });
        });
      }
    });
  },

  removeQuestion(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除题目',
      content: '删除后会同步清理使用该题目的评测与作答记录，且无法恢复。确定继续吗？',
      confirmText: '删除',
      confirmColor: '#b33a32',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '正在清理', mask: true });
        api.deleteQuestion(id).then(() => {
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          return this.load(true);
        }).catch((err) => {
          wx.hideLoading();
          wx.showModal({ title: '删除失败', content: err.message || '请稍后重试', showCancel: false });
        });
      }
    });
  },

  reload() {
    this.load(true);
  }
});
