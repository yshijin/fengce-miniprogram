const api = require('../../utils/api');
const data = require('../../utils/data');

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    role: 'student',
    roleName: '',
    initial: '',
    stats: [],
    infoRows: [],
    version: api.config.version,
    baseUrl: api.config.baseUrl,
    lastRefresh: ''
  },

  onShow() {
    if (!api.getToken() || !api.getUser()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.load(false);
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
  },

  load(force) {
    if (!force) this.setData({ loading: !this.data.user, error: '' });
    return api.loadBootstrap(force).then((boot) => {
      const user = boot.user;
      const role = user.role;
      const classInfo = data.findClass(boot, user.classId);
      const course = (boot.courses || []).filter((c) => c.id === user.courseId)[0];
      const attempts = data.studentAttempts(boot, user.id).filter((a) => a.status === 'submitted');
      let stats = [];
      let infoRows = [];

      if (role === 'teacher') {
        const classes = boot.classes || [];
        const students = boot.students || [];
        const papers = (boot.papers || []).filter((p) => !p.ownerStudentId);
        stats = [
          { label: '负责教学班', value: classes.length, tone: 'blue' },
          { label: '班级学生', value: students.length, tone: 'green' },
          { label: '测评试卷', value: papers.length, tone: 'amber' }
        ];
        infoRows = [
          { label: '角色', value: '教师' },
          { label: '账号', value: user.username },
          { label: '课程', value: course ? course.name : '—' },
          { label: '教学班', value: classes.map((c) => c.name).join('、') || '—' }
        ];
      } else if (role === 'course_leader') {
        stats = [
          { label: '课程', value: (boot.courses || []).length, tone: 'blue' },
          { label: '教学班', value: (boot.classes || []).length, tone: 'green' },
          { label: '教师', value: (boot.teachers || []).length, tone: 'amber' }
        ];
        infoRows = [
          { label: '角色', value: '课程负责人' },
          { label: '账号', value: user.username },
          { label: '课程', value: course ? course.name : '—' },
          { label: '学生总数', value: String((boot.students || []).length) }
        ];
      } else {
        const remaining = boot.wrongBook ? boot.wrongBook.remaining : 0;
        stats = [
          { label: '已完成测评', value: attempts.length, tone: 'blue' },
          { label: '平均得分率', value: data.avgPct(attempts) + '%', tone: 'green' },
          { label: '待掌握错题', value: remaining, tone: 'amber' }
        ];
        infoRows = [
          { label: '角色', value: '学生' },
          { label: '学号', value: user.username },
          { label: '教学班', value: classInfo ? classInfo.name : '—' },
          { label: '课程', value: course ? course.name : '—' }
        ];
      }

      this.setData({
        loading: false,
        error: '',
        user: user,
        role: role,
        roleName: api.roleName(role),
        initial: String(user.name || '?').substring(0, 1),
        stats: stats,
        infoRows: infoRows,
        lastRefresh: data.formatDate(new Date().toISOString(), true)
      });
    }).catch((err) => {
      this.setData({ loading: false, error: err.message || '加载个人信息失败' });
    });
  },

  refresh() {
    wx.showLoading({ title: '刷新数据', mask: true });
    this.load(true).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已刷新', icon: 'success' });
    }).catch(() => {
      wx.hideLoading();
    });
  },

  about() {
    wx.showModal({
      title: '智学测评 · 小程序版',
      content: '这是现有 Web 版的原生小程序端原型，复用同一套 Spring Boot 后端与数据库。\n\n小程序端使用 Bearer Token 登录，Web 端 HttpSession 不受影响。\n\n当前接口地址：' + this.data.baseUrl,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新输入账号密码，确定退出吗？',
      confirmText: '退出',
      confirmColor: '#e5484d',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '正在退出', mask: true });
        api.logout().then(() => {
          wx.hideLoading();
          wx.reLaunch({ url: '/pages/login/login' });
        }).catch(() => {
          wx.hideLoading();
          api.clearSession();
          wx.reLaunch({ url: '/pages/login/login' });
        });
      }
    });
  },

  reload() {
    this.load(true);
  }
});
