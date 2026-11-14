const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    paper: null,
    attempt: null,
    questions: [],
    current: null,
    currentIndex: 0,
    answers: {},
    answeredCount: 0,
    totalCount: 0,
    progressWidth: 0,
    remainingText: '--:--',
    remainingSeconds: 0,
    timerDanger: false,
    showCard: false,
    submitting: false,
    canRetrySubmit: false,
    savingText: ''
  },

  onLoad(options) {
    this.paperId = options && options.paperId ? options.paperId : '';
    this.clockTimer = null;
    this.saveTimer = null;
    this.saveChain = Promise.resolve();
    this.serverOffset = 0;
    this.deadline = 0;
    this.submitted = false;
    this.autoSubmitting = false;
    this.rawQuestions = [];
    if (!this.paperId) {
      this.setData({ loading: false, error: '缺少试卷编号' });
      return;
    }
    wx.setNavigationBarTitle({ title: '在线作答' });
    this.load();
  },

  onHide() {
    if (!this.submitted) this.saveNow(this.data.answers);
  },

  onUnload() {
    this.clearTimer();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (!this.submitted && this.data.attempt) this.saveNow(this.data.answers);
  },

  load() {
    this.setData({ loading: true, error: '' });
    api.loadBootstrap(false).then((boot) => {
      const user = boot.user;
      if (!user || user.role !== 'student') {
        this.setData({ loading: false, error: '仅学生可以进入作答' });
        return null;
      }
      const paper = data.findPaper(boot, this.paperId);
      if (!paper) {
        this.setData({ loading: false, error: '试卷不存在或已删除' });
        return null;
      }
      const existing = data.attemptOf(boot, paper.id, user.id);
      if (existing && existing.status === 'submitted') {
        wx.redirectTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(existing.id) });
        return null;
      }
      const status = data.paperStatus(paper, data.serverNow(boot));
      if (!existing && status.key !== 'ongoing') {
        this.setData({
          loading: false,
          error: status.key === 'upcoming' ? '测评尚未开始' : '测评已结束'
        });
        return null;
      }
      return api.startAttempt(paper.id).then((res) => {
        const attempt = res.attempt;
        if (!attempt) {
          this.setData({ loading: false, error: '无法开始作答' });
          return;
        }
        if (attempt.status === 'submitted') {
          wx.redirectTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(attempt.id) });
          return;
        }
        this.boot = boot;
        this.paper = paper;
        this.attempt = attempt;
        this.rawQuestions = data.paperQuestions(paper, boot);
        if (!this.rawQuestions.length) {
          this.setData({ loading: false, error: '试卷没有可作答的题目' });
          return;
        }
        const now = res.serverNow ? Date.parse(res.serverNow) : Date.now();
        this.serverOffset = now - Date.now();
        const started = data.parseTime(attempt.startedAt) || now;
        const durationMs = (Number(paper.duration) || 60) * 60000;
        const endAt = data.parseTime(paper.endAt);
        this.deadline = endAt ? Math.min(started + durationMs, endAt) : started + durationMs;
        const answers = attempt.answers || {};
        if (this.deadline <= now) {
          this.applyAnswers(answers, 0);
          this.setData({ loading: false, error: '本次作答时间已结束，正在自动交卷…', canRetrySubmit: true });
          this.submit(true);
          return;
        }
        this.applyAnswers(answers, 0);
        this.setData({
          loading: false,
          error: '',
          paper: {
            id: paper.id,
            name: paper.name,
            teacherName: paper.teacherName,
            duration: paper.duration,
            total: data.paperTotal(paper)
          },
          attempt: {
            id: attempt.id,
            startedAt: attempt.startedAt
          }
        });
        this.startTimer();
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载试卷失败' });
    });
  },

  applyAnswers(answers, index) {
    const qs = this.rawQuestions || [];
    const normalized = {};
    const views = qs.map((q, i) => {
      let value = answers && answers[q.qid] ? String(answers[q.qid]).toUpperCase() : '';
      if (q.type === 'multi') {
        value = value.replace(/[^A-F]/g, '').split('').sort().join('');
      }
      normalized[q.qid] = value;
      const options = (q.options || []).map((opt) => ({
        key: opt.key,
        text: opt.text,
        selected: value.indexOf(opt.key) >= 0
      }));
      return {
        id: q.id,
        qid: q.qid,
        type: q.type,
        typeLabel: q.type === 'multi' ? '多选题' : (q.type === 'judge' ? '判断题' : '单选题'),
        stem: q.stem,
        options: options,
        score: q.score,
        number: i + 1,
        answered: !!value
      };
    });
    const safeIndex = Math.max(0, Math.min(index || 0, views.length - 1));
    const current = views[safeIndex] || null;
    const answeredCount = views.filter((q) => q.answered).length;
    this.setData({
      questions: views,
      current: current,
      currentIndex: safeIndex,
      answers: normalized,
      answeredCount: answeredCount,
      totalCount: views.length,
      progressWidth: views.length ? Math.round(answeredCount / views.length * 100) : 0
    });
  },

  onSelect(e) {
    if (this.data.submitting || this.submitted) return;
    const key = e.currentTarget.dataset.key;
    const q = this.data.current;
    if (!q || !key) return;
    const answers = Object.assign({}, this.data.answers);
    let value = answers[q.qid] || '';
    if (q.type === 'multi') {
      if (value.indexOf(key) >= 0) {
        value = value.replace(key, '');
      } else {
        value = value + key;
      }
      value = value.split('').sort().join('');
    } else {
      value = key;
    }
    answers[q.qid] = value;
    this.applyAnswers(answers, this.data.currentIndex);
    this.queueSave(answers);
  },

  onPrev() {
    if (this.data.currentIndex <= 0) return;
    this.applyAnswers(this.data.answers, this.data.currentIndex - 1);
    wx.pageScrollTo({ scrollTop: 0, duration: 160 });
  },

  onNext() {
    if (this.data.currentIndex >= this.data.totalCount - 1) return;
    this.applyAnswers(this.data.answers, this.data.currentIndex + 1);
    wx.pageScrollTo({ scrollTop: 0, duration: 160 });
  },

  goQuestion(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.applyAnswers(this.data.answers, index);
    this.setData({ showCard: false });
    wx.pageScrollTo({ scrollTop: 0, duration: 160 });
  },

  toggleCard() {
    this.setData({ showCard: !this.data.showCard });
  },

  queueSave(answers) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.setData({ savingText: '保存中…' });
    const snapshot = Object.assign({}, answers);
    this.saveTimer = setTimeout(() => {
      this.saveNow(snapshot);
    }, 300);
  },

  saveNow(answers) {
    if (this.submitted || !this.attempt) return Promise.resolve();
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const payload = Object.assign({}, answers || this.data.answers);
    this.saveChain = this.saveChain.then(() => {
      return api.saveAnswers(this.attempt.id, payload);
    }).then((res) => {
      if (this.submitted) return;
      if (res && res.attempt && res.attempt.status === 'submitted') {
        this.submitted = true;
        this.clearTimer();
        wx.showToast({ title: res.message || '已自动交卷', icon: 'none' });
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(res.attempt.id) });
        }, 500);
        return;
      }
      this.setData({ savingText: '已自动保存' });
    }).catch((err) => {
      if (this.submitted) return;
      this.setData({ savingText: '保存失败' });
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    });
    return this.saveChain;
  },

  startTimer() {
    this.clearTimer();
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 1000);
  },

  clearTimer() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  },

  tick() {
    if (!this.deadline) return;
    const remaining = Math.max(0, Math.floor((this.deadline - (Date.now() + this.serverOffset)) / 1000));
    this.setData({
      remainingSeconds: remaining,
      remainingText: data.formatClock(remaining),
      timerDanger: remaining <= 300
    });
    if (remaining <= 0 && !this.submitted && !this.autoSubmitting) {
      this.autoSubmitting = true;
      this.submit(true);
    }
  },

  submit(auto) {
    const isAuto = auto === true;
    if (this.data.submitting || this.submitted) return;
    const doSubmit = () => {
      this.setData({ submitting: true });
      if (isAuto) wx.showLoading({ title: '时间到，正在交卷' });
      api.submitAttempt(this.attempt.id, this.data.answers).then((res) => {
        this.submitted = true;
        this.clearTimer();
        if (this.saveTimer) clearTimeout(this.saveTimer);
        if (isAuto) wx.hideLoading();
        wx.redirectTo({ url: '/pages/student/result/result?attemptId=' + encodeURIComponent(res.attempt.id) });
      }).catch((err) => {
        this.setData({ submitting: false });
        this.autoSubmitting = false;
        if (isAuto) {
          this.setData({ canRetrySubmit: !!this.attempt });
          wx.hideLoading();
        }
        wx.showModal({
          title: '交卷失败',
          content: err.message || '请检查网络后重试',
          showCancel: false
        });
      });
    };

    if (isAuto) {
      doSubmit();
      return;
    }
    wx.showModal({
      title: '确认交卷',
      content: '已作答 ' + this.data.answeredCount + ' / ' + this.data.totalCount + ' 题，交卷后不能修改。',
      confirmText: '交卷',
      success: (res) => {
        if (res.confirm) doSubmit();
      }
    });
  },

  exit() {
    if (this.data.submitting) return;
    wx.showModal({
      title: '退出作答',
      content: '已作答内容会自动保存，下次可以继续作答。确定退出吗？',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return;
        const go = () => wx.reLaunch({ url: '/pages/student/home/home' });
        this.saveNow(this.data.answers).then(go, go);
      }
    });
  },

  retrySubmit() {
    if (this.data.submitting || this.submitted) return;
    this.submit(true);
  }
});
