const api = require('../../../utils/api');
const data = require('../../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    mode: 'student',
    paper: null,
    attempt: null,
    student: null,
    paperClass: '',
    scoreRate: 0,
    grade: '',
    correctCount: 0,
    totalCount: 0,
    timeText: '',
    submittedText: '',
    kpStats: [],
    reviews: [],
    allReviews: [],
    hasMore: false,
    showAll: false,
    toggleLabel: '',
    canShowAnswer: true,
    policyText: '',
    inProgress: false
  },

  onLoad(options) {
    this.attemptId = options && options.attemptId ? options.attemptId : '';
    this.mode = options && options.mode === 'teacher' ? 'teacher' : 'student';
    this.setData({ mode: this.mode });
    if (!this.attemptId) {
      this.setData({ loading: false, error: '缺少作答记录编号' });
      return;
    }
    wx.setNavigationBarTitle({ title: this.mode === 'teacher' ? '学生报告' : '测评结果' });
    this.load();
  },

  load() {
    this.setData({ loading: true, error: '' });
    api.loadBootstrap(true).then((boot) => {
      const attempt = data.findAttempt(boot, this.attemptId);
      if (!attempt) {
        this.setData({ loading: false, error: '作答记录不存在或已删除' });
        return;
      }
      const paper = data.findPaper(boot, attempt.paperId);
      if (!paper) {
        this.setData({ loading: false, error: '试卷不存在或已删除' });
        return;
      }
      const student = data.findStudent(boot, attempt.studentId);
      const questions = data.paperQuestions(paper, boot);
      const submitted = attempt.status === 'submitted';
      const now = data.serverNow(boot);
      const policy = paper.answerPolicy || 'afterSubmit';
      const afterEnd = paper.endAt ? now > data.parseTime(paper.endAt) : false;
      let canShow = false;
      if (submitted) {
        if (this.mode === 'teacher') canShow = true;
        else if (policy === 'afterSubmit') canShow = true;
        else if (policy === 'afterEnd') canShow = afterEnd;
      }

      const reviews = submitted ? questions.map((q, index) => {
        const mine = attempt.answers ? attempt.answers[q.qid] : '';
        const correct = q.answer || '';
        const isCorrect = !!(attempt.correct && attempt.correct[q.qid]);
        return {
          id: q.qid,
          number: index + 1,
          typeLabel: q.type === 'multi' ? '多选题' : (q.type === 'judge' ? '判断题' : '单选题'),
          stem: q.stem,
          score: q.score,
          isCorrect: isCorrect,
          myAnswerText: data.answerText(q, mine),
          correctAnswerText: data.answerText(q, correct),
          options: data.optionViews(q, mine, correct, canShow),
          analysis: q.analysis || ''
        };
      }) : [];

      const kpStats = submitted ? data.kpStatsForAttempt(boot, paper, attempt) : [];
      const rate = data.pct(attempt.score, attempt.total);
      const allReviews = reviews;
      const visible = canShow ? allReviews.slice(0, 20) : [];
      let policyText = '';
      if (!submitted) policyText = '交卷后可查看答案和解析';
      else if (this.mode === 'teacher') policyText = '教师视角：答案和解析已开放';
      else if (policy === 'never') policyText = '本试卷未开放答案查看';
      else if (policy === 'afterEnd' && !afterEnd) policyText = '测评结束后可查看答案和解析';
      else policyText = '答案和解析已开放';

      this.setData({
        loading: false,
        error: '',
        paper: {
          id: paper.id,
          name: paper.name,
          teacherName: paper.teacherName,
          total: data.paperTotal(paper),
          duration: paper.duration
        },
        attempt: {
          id: attempt.id,
          score: attempt.score,
          total: attempt.total,
          correctCount: attempt.correctCount,
          status: attempt.status,
          timeUsed: attempt.timeUsed
        },
        student: student,
        paperClass: data.classNamesForPaper(boot, paper),
        scoreRate: rate,
        grade: data.gradeLabel(rate),
        correctCount: attempt.correctCount || 0,
        totalCount: questions.length,
        timeText: attempt.timeUsed ? attempt.timeUsed + ' 分钟' : '—',
        submittedText: data.formatFullDate(attempt.submittedAt),
        kpStats: kpStats,
        allReviews: allReviews,
        reviews: visible,
        hasMore: canShow && allReviews.length > 20,
        showAll: false,
        toggleLabel: '展开全部 ' + allReviews.length + ' 题',
        canShowAnswer: canShow,
        policyText: policyText,
        inProgress: !submitted
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载结果失败' });
    });
  },

  toggleAll() {
    const showAll = !this.data.showAll;
    this.setData({
      showAll: showAll,
      reviews: showAll ? this.data.allReviews : this.data.allReviews.slice(0, 20),
      toggleLabel: showAll ? '收起答题回顾' : '展开全部 ' + this.data.allReviews.length + ' 题'
    });
  },

  continueExam() {
    if (!this.data.paper) return;
    wx.redirectTo({ url: '/pages/student/exam/exam?paperId=' + encodeURIComponent(this.data.paper.id) });
  },

  goHome() {
    const user = api.getUser();
    wx.reLaunch({ url: api.homeFor(user ? user.role : 'student') });
  },

  goWrongbook() {
    wx.reLaunch({ url: '/pages/student/wrongbook/wrongbook' });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.reLaunch({ url: '/pages/teacher/data/data' });
      }
    });
  },

  retry() {
    this.load();
  }
});
