const NAV = {
  student: [
    { url: '/pages/student/home/home', label: '测试', icon: '测' },
    { url: '/pages/student/history/history', label: '成绩', icon: '绩' },
    { url: '/pages/student/wrongbook/wrongbook', label: '错题', icon: '错' },
    { url: '/pages/mine/mine', label: '我的', icon: '我' }
  ],
  teacher: [
    { url: '/pages/teacher/home/home', label: '工作台', icon: '台' },
    { url: '/pages/teacher/students/students', label: '学生', icon: '生' },
    { url: '/pages/teacher/papers/papers', label: '试卷', icon: '卷' },
    { url: '/pages/teacher/data/data', label: '数据', icon: '数' },
    { url: '/pages/mine/mine', label: '我的', icon: '我' }
  ],
  course_leader: [
    { url: '/pages/cl/home/home', label: '概览', icon: '览' },
    { url: '/pages/mine/mine', label: '我的', icon: '我' }
  ]
};

Component({
  properties: {
    role: {
      type: String,
      value: 'student'
    },
    active: {
      type: String,
      value: ''
    }
  },

  data: {
    items: NAV.student
  },

  lifetimes: {
    attached() {
      this.refresh();
    }
  },

  observers: {
    role() {
      this.refresh();
    }
  },

  methods: {
    refresh() {
      const role = this.data.role;
      this.setData({ items: NAV[role] || NAV.student });
    },

    go(e) {
      const url = e.currentTarget.dataset.url;
      if (!url || url === this.data.active) return;
      wx.reLaunch({ url: url });
    }
  }
});
